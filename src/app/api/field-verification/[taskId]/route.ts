import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRolePermission } from '@/lib/rbac'

// GET /api/field-verification/[taskId]
// Fetch a single field verification result by task ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  const authError = checkRolePermission(request, 'view:field_verification')
  if (authError) return authError

  try {
    const { taskId } = await context.params

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        parcel: {
          include: {
            owner: { select: { name: true, contactInfo: true } },
            compensation: { select: { assessedAmount: true, paidAmount: true, status: true } },
          },
        },
        project: {
          select: { id: true, name: true, type: true, state: true, district: true },
        },
        fieldVerification: true,
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error: unknown) {
    const err = error as Error
    console.error('Error fetching task for field verification:', err)
    return NextResponse.json(
      { error: 'Failed to fetch task', details: err.message },
      { status: 500 }
    )
  }
}
