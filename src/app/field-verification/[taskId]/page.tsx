import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/Navbar'
import FieldVerificationForm from '@/components/field-verification/FieldVerificationForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ taskId: string }>
}

async function getTaskData(taskId: string) {
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
  return task
}

export default async function FieldVerificationTaskPage({ params }: Props) {
  const { taskId } = await params
  const task = await getTaskData(taskId)

  if (!task) notFound()
  if (task.type !== 'FIELD_VERIFICATION') notFound()

  // Extract parcel coordinates from geometry
  let lat: number | null = null
  let lng: number | null = null
  if (task.parcel?.geometry) {
    const geo = task.parcel.geometry as { coordinates?: number[][][] }
    const coords = geo.coordinates?.[0]
    if (coords && coords.length > 0) {
      const ring = coords.slice(0, -1)
      lng = parseFloat((ring.reduce((s, c) => s + c[0], 0) / ring.length).toFixed(6))
      lat = parseFloat((ring.reduce((s, c) => s + c[1], 0) / ring.length).toFixed(6))
    }
  }

  // Serialize for client component
  const taskData = {
    id: task.id,
    description: task.description,
    priority: task.priority as string,
    responsibleRole: task.responsibleRole,
    daysPending: task.daysPending,
    dueDate: task.dueDate?.toISOString() ?? null,
    resolved: task.resolved,
    parcel: task.parcel
      ? {
          id: task.parcel.id,
          parcelCode: task.parcel.parcelCode,
          surveyNumber: task.parcel.surveyNumber,
          village: task.parcel.village,
          district: task.parcel.district,
          state: task.parcel.state,
          areaAcres: task.parcel.areaAcres,
          acquisitionStatus: task.parcel.acquisitionStatus as string,
          legalStatus: task.parcel.legalStatus as string,
          rrStatus: task.parcel.rrStatus as string,
          lat,
          lng,
          owner: task.parcel.owner
            ? {
                name: task.parcel.owner.name,
                contactInfo: task.parcel.owner.contactInfo as Record<string, string>,
              }
            : null,
          compensation: task.parcel.compensation
            ? {
                assessedAmount: task.parcel.compensation.assessedAmount,
                paidAmount: task.parcel.compensation.paidAmount,
                status: task.parcel.compensation.status as string,
              }
            : null,
        }
      : null,
    project: task.project
      ? {
          id: task.project.id,
          name: task.project.name,
          type: task.project.type as string,
          state: task.project.state,
          district: task.project.district,
        }
      : null,
    existingVerification: task.fieldVerification
      ? {
          id: task.fieldVerification.id,
          checklistParcelId: task.fieldVerification.checklistParcelId,
          checklistBoundary: task.fieldVerification.checklistBoundary,
          checklistArea: task.fieldVerification.checklistArea,
          checklistLandUse: task.fieldVerification.checklistLandUse,
          checklistOwnership: task.fieldVerification.checklistOwnership,
          checklistEncumbrance: task.fieldVerification.checklistEncumbrance,
          remarks: task.fieldVerification.remarks ?? '',
          gpsLat: task.fieldVerification.gpsLat,
          gpsLng: task.fieldVerification.gpsLng,
          gpsAccuracy: task.fieldVerification.gpsAccuracy,
          photoRef: task.fieldVerification.photoRef,
          verifierRole: task.fieldVerification.verifierRole,
          submittedAt: task.fieldVerification.submittedAt.toISOString(),
        }
      : null,
  }

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Navbar />
      <FieldVerificationForm task={taskData} />
    </div>
  )
}
