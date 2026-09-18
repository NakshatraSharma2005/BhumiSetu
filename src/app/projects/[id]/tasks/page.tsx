import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TaskPriority } from '@/generated/prisma/client'
import { Navbar } from '@/components/Navbar'
import ProjectTasksClient from '@/components/tasks/ProjectTasksClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export default async function ProjectTasksPage({ params }: Props) {
  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, type: true, state: true, district: true, status: true },
  })

  if (!project) notFound()

  const rawTasks = await prisma.task.findMany({
    where: { projectId: id },
    include: {
      parcel: {
        select: { id: true, parcelCode: true, village: true, district: true },
      },
      assignee: {
        select: { id: true, name: true, role: true },
      },
    },
  })

  // Sort: HIGH → MEDIUM → LOW, then daysPending desc
  rawTasks.sort((a, b) => {
    const pDiff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    if (pDiff !== 0) return pDiff
    return b.daysPending - a.daysPending
  })

  // Compute stats
  let unresolvedHigh = 0, unresolvedMedium = 0, unresolvedLow = 0, resolvedCount = 0
  for (const t of rawTasks) {
    if (t.resolved) { resolvedCount++; continue }
    if (t.priority === TaskPriority.HIGH) unresolvedHigh++
    else if (t.priority === TaskPriority.MEDIUM) unresolvedMedium++
    else unresolvedLow++
  }

  const maxDaysPending = rawTasks
    .filter(t => !t.resolved)
    .reduce((max, t) => Math.max(max, t.daysPending), 0)

  const tasks = rawTasks.map(t => ({
    id: t.id,
    type: t.type as string,
    description: t.description,
    responsibleRole: t.responsibleRole,
    dueDate: t.dueDate?.toISOString() ?? null,
    daysPending: t.daysPending,
    priority: t.priority as string,
    resolved: t.resolved,
    createdAt: t.createdAt.toISOString(),
    parcel: t.parcel
      ? { id: t.parcel.id, parcelCode: t.parcel.parcelCode, village: t.parcel.village, district: t.parcel.district }
      : null,
    assignee: t.assignee
      ? { id: t.assignee.id, name: t.assignee.name, role: t.assignee.role as string }
      : null,
  }))

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Navbar />
      <ProjectTasksClient
        project={{
          id: project.id,
          name: project.name,
          type: project.type as string,
          state: project.state,
          district: project.district,
          status: project.status as string,
        }}
        initialTasks={tasks}
        stats={{
          total: rawTasks.length,
          unresolved: unresolvedHigh + unresolvedMedium + unresolvedLow,
          resolved: resolvedCount,
          byPriority: { HIGH: unresolvedHigh, MEDIUM: unresolvedMedium, LOW: unresolvedLow },
          maxDaysPending,
        }}
      />
    </div>
  )
}
