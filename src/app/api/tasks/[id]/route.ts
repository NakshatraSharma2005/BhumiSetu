import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true, resolved: true, projectId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Toggle resolved boolean
    const updated = await prisma.task.update({
      where: { id },
      data: { resolved: !existing.resolved },
      include: {
        parcel: {
          select: { id: true, parcelCode: true, village: true },
        },
      },
    })

    return NextResponse.json({
      id: updated.id,
      type: updated.type,
      description: updated.description,
      priority: updated.priority,
      resolved: updated.resolved,
      daysPending: updated.daysPending,
      parcel: updated.parcel
        ? {
            id: updated.parcel.id,
            parcelCode: updated.parcel.parcelCode,
            village: updated.parcel.village,
          }
        : null,
    })
  } catch (error: any) {
    console.error('Error updating task:', error)
    return NextResponse.json(
      { error: 'Failed to update task', details: error.message },
      { status: 500 }
    )
  }
}
