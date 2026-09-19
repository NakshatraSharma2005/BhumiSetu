import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRolePermission, getRoleFromHeader } from '@/lib/rbac'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/field-verification?taskId=...
// Returns existing verification result for a task
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authError = checkRolePermission(request, 'view:field_verification')
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    // Return all field verification tasks
    try {
      const tasks = await prisma.task.findMany({
        where: { type: 'FIELD_VERIFICATION' },
        include: {
          parcel: {
            select: {
              id: true,
              parcelCode: true,
              village: true,
              district: true,
              state: true,
              areaAcres: true,
            },
          },
          project: {
            select: { id: true, name: true, state: true, district: true },
          },
          fieldVerification: true,
        },
        orderBy: [{ resolved: 'asc' }, { daysPending: 'desc' }],
      })
      return NextResponse.json({ tasks })
    } catch (error: unknown) {
      const err = error as Error
      return NextResponse.json(
        { error: 'Failed to fetch tasks', details: err.message },
        { status: 500 }
      )
    }
  }

  try {
    const verification = await prisma.fieldVerification.findUnique({
      where: { taskId },
      include: {
        parcel: {
          select: {
            parcelCode: true,
            village: true,
            district: true,
            areaAcres: true,
          },
        },
      },
    })

    if (!verification) {
      return NextResponse.json({ verification: null })
    }

    return NextResponse.json({ verification })
  } catch (error: unknown) {
    const err = error as Error
    console.error('Error fetching field verification:', err)
    return NextResponse.json(
      { error: 'Failed to fetch field verification', details: err.message },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/field-verification
// Submit / update a field verification result
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const authError = checkRolePermission(request, 'submit:field_verification')
  if (authError) return authError

  const role = getRoleFromHeader(request)!

  try {
    const body = await request.json()
    const {
      taskId,
      parcelId,
      checklistParcelId,
      checklistBoundary,
      checklistArea,
      checklistLandUse,
      checklistOwnership,
      checklistEncumbrance,
      remarks,
      gpsLat,
      gpsLng,
      gpsAccuracy,
      photoRef,
    } = body

    if (!taskId || !parcelId) {
      return NextResponse.json(
        { error: 'taskId and parcelId are required' },
        { status: 400 }
      )
    }

    // Verify task exists and is a FIELD_VERIFICATION type
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, type: true, parcelId: true, resolved: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.type !== 'FIELD_VERIFICATION') {
      return NextResponse.json(
        { error: 'Task is not a FIELD_VERIFICATION task' },
        { status: 400 }
      )
    }

    // Upsert the verification record
    const verification = await prisma.fieldVerification.upsert({
      where: { taskId },
      create: {
        taskId,
        parcelId,
        verifierRole: role,
        checklistParcelId: Boolean(checklistParcelId),
        checklistBoundary: Boolean(checklistBoundary),
        checklistArea: Boolean(checklistArea),
        checklistLandUse: Boolean(checklistLandUse),
        checklistOwnership: Boolean(checklistOwnership),
        checklistEncumbrance: Boolean(checklistEncumbrance),
        remarks: remarks ?? null,
        gpsLat: gpsLat ?? null,
        gpsLng: gpsLng ?? null,
        gpsAccuracy: gpsAccuracy ?? null,
        photoRef: photoRef ?? null,
        submittedAt: new Date(),
      },
      update: {
        verifierRole: role,
        checklistParcelId: Boolean(checklistParcelId),
        checklistBoundary: Boolean(checklistBoundary),
        checklistArea: Boolean(checklistArea),
        checklistLandUse: Boolean(checklistLandUse),
        checklistOwnership: Boolean(checklistOwnership),
        checklistEncumbrance: Boolean(checklistEncumbrance),
        remarks: remarks ?? null,
        gpsLat: gpsLat ?? null,
        gpsLng: gpsLng ?? null,
        gpsAccuracy: gpsAccuracy ?? null,
        photoRef: photoRef ?? null,
        submittedAt: new Date(),
      },
    })

    // Mark the task as resolved
    await prisma.task.update({
      where: { id: taskId },
      data: { resolved: true },
    })

    return NextResponse.json({ success: true, verification })
  } catch (error: unknown) {
    const err = error as Error
    console.error('Error submitting field verification:', err)
    return NextResponse.json(
      { error: 'Failed to submit field verification', details: err.message },
      { status: 500 }
    )
  }
}
