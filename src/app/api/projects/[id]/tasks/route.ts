import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskPriority } from '@/generated/prisma/client'

// Priority sort order for manual sorting
const PRIORITY_ORDER: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, state: true, district: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const priorityParam = searchParams.get('priority')
    const resolvedParam = searchParams.get('resolved') // 'true' | 'false' | null

    // Build where filter
    const where: Record<string, unknown> = { projectId: id }

    if (
      priorityParam &&
      priorityParam !== 'ALL' &&
      Object.values(TaskPriority).includes(priorityParam as TaskPriority)
    ) {
      where.priority = priorityParam as TaskPriority
    }

    if (resolvedParam === 'true') {
      where.resolved = true
    } else if (resolvedParam === 'false') {
      where.resolved = false
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        parcel: {
          select: {
            id: true,
            parcelCode: true,
            village: true,
            district: true,
          },
        },
        assignee: {
          select: { id: true, name: true, role: true },
        },
      },
    })

    // Sort: priority desc (HIGH→MEDIUM→LOW), then daysPending desc
    tasks.sort((a, b) => {
      const pDiff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
      if (pDiff !== 0) return pDiff
      return b.daysPending - a.daysPending
    })

    // Aggregate stats across ALL tasks for this project (unfiltered)
    const allTasks = await prisma.task.findMany({
      where: { projectId: id },
      select: { priority: true, resolved: true, daysPending: true },
    })

    let unresolvedHigh = 0
    let unresolvedMedium = 0
    let unresolvedLow = 0
    let resolvedCount = 0

    for (const t of allTasks) {
      if (t.resolved) {
        resolvedCount++
      } else {
        if (t.priority === TaskPriority.HIGH) unresolvedHigh++
        else if (t.priority === TaskPriority.MEDIUM) unresolvedMedium++
        else unresolvedLow++
      }
    }

    const unresolvedTotal = unresolvedHigh + unresolvedMedium + unresolvedLow
    const maxDaysPending = allTasks
      .filter(t => !t.resolved)
      .reduce((max, t) => Math.max(max, t.daysPending), 0)

    return NextResponse.json({
      project,
      stats: {
        total: allTasks.length,
        unresolved: unresolvedTotal,
        resolved: resolvedCount,
        byPriority: {
          HIGH: unresolvedHigh,
          MEDIUM: unresolvedMedium,
          LOW: unresolvedLow,
        },
        maxDaysPending,
      },
      tasks: tasks.map(t => ({
        id: t.id,
        type: t.type,
        description: t.description,
        responsibleRole: t.responsibleRole,
        dueDate: t.dueDate?.toISOString() ?? null,
        daysPending: t.daysPending,
        priority: t.priority,
        resolved: t.resolved,
        createdAt: t.createdAt.toISOString(),
        parcel: t.parcel
          ? {
              id: t.parcel.id,
              parcelCode: t.parcel.parcelCode,
              village: t.parcel.village,
              district: t.parcel.district,
            }
          : null,
        assignee: t.assignee
          ? { id: t.assignee.id, name: t.assignee.name, role: t.assignee.role }
          : null,
      })),
    })
  } catch (error: any) {
    console.error('Error fetching project tasks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: error.message },
      { status: 500 }
    )
  }
}
