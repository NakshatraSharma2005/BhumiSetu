import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AcquisitionStatus, LegalStatus, RRStatus } from '@/generated/prisma/client'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const project = await prisma.project.findUnique({
      where: { id }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 1. Live counts from LandParcel by acquisitionStatus
    const acquisitionCounts = await prisma.landParcel.groupBy({
      by: ['acquisitionStatus'],
      where: { projectId: id },
      _count: { _all: true }
    })

    const acquisitionMap: Record<string, number> = {}
    acquisitionCounts.forEach(item => {
      acquisitionMap[item.acquisitionStatus] = item._count._all
    })

    const acquiredCount = (acquisitionMap[AcquisitionStatus.ACQUIRED] || 0) + (acquisitionMap[AcquisitionStatus.POSSESSION] || 0)
    const underProcessCount =
      (acquisitionMap[AcquisitionStatus.VERIFICATION] || 0) +
      (acquisitionMap[AcquisitionStatus.NOTIFICATION] || 0) +
      (acquisitionMap[AcquisitionStatus.OBJECTION] || 0) +
      (acquisitionMap[AcquisitionStatus.COMPENSATION_PROCESSING] || 0) +
      (acquisitionMap[AcquisitionStatus.COMPENSATION_PAID] || 0)
    const legalDisputeCount = acquisitionMap[AcquisitionStatus.LEGAL_DISPUTE] || 0
    const notStartedCount = acquisitionMap[AcquisitionStatus.NOT_STARTED] || 0
    const totalParcelsComputed = Object.values(acquisitionMap).reduce((a, b) => a + b, 0)

    // 2. Live counts from LandParcel by legalStatus
    const legalStatusCounts = await prisma.landParcel.groupBy({
      by: ['legalStatus'],
      where: { projectId: id },
      _count: { _all: true }
    })
    const legalStatusMap: Record<string, number> = {}
    legalStatusCounts.forEach(item => {
      legalStatusMap[item.legalStatus] = item._count._all
    })

    // 3. Live counts from LandParcel by rrStatus
    const rrStatusCounts = await prisma.landParcel.groupBy({
      by: ['rrStatus'],
      where: { projectId: id },
      _count: { _all: true }
    })
    const rrStatusMap: Record<string, number> = {}
    rrStatusCounts.forEach(item => {
      rrStatusMap[item.rrStatus] = item._count._all
    })

    // 4. Live compensation sums from actual Compensation records linked to project parcels
    const compAgg = await prisma.compensation.aggregate({
      where: { parcel: { projectId: id } },
      _sum: {
        assessedAmount: true,
        paidAmount: true
      },
      _count: { _all: true }
    })

    const liveAssessedAmount = compAgg._sum.assessedAmount ?? project.compensationAssessed
    const livePaidAmount = compAgg._sum.paidAmount ?? project.compensationPaid
    const livePendingCompensation = Math.max(0, liveAssessedAmount - livePaidAmount)

    // 5. Live land area sums
    const landAgg = await prisma.landParcel.aggregate({
      where: { projectId: id },
      _sum: { areaAcres: true }
    })
    const acquiredLandAgg = await prisma.landParcel.aggregate({
      where: {
        projectId: id,
        acquisitionStatus: { in: [AcquisitionStatus.ACQUIRED, AcquisitionStatus.POSSESSION] }
      },
      _sum: { areaAcres: true }
    })

    const liveTotalLandAcres = Number((landAgg._sum.areaAcres ?? project.landRequiredAcres).toFixed(2))
    const liveAcquiredLandAcres = Number((acquiredLandAgg._sum.areaAcres ?? project.landAcquiredAcres).toFixed(2))
    const overallProgressPercent = totalParcelsComputed > 0
      ? Number(((acquiredCount / totalParcelsComputed) * 100).toFixed(1))
      : (project.landRequiredAcres > 0 ? Number(((project.landAcquiredAcres / project.landRequiredAcres) * 100).toFixed(1)) : 0)

    // 6. Legal cases summary
    const legalCasesAgg = await prisma.legalCase.groupBy({
      by: ['status'],
      where: { parcel: { projectId: id } },
      _count: { _all: true }
    })
    let totalLegalCases = 0
    let resolvedLegalCases = 0
    let pendingLegalCases = 0

    legalCasesAgg.forEach(item => {
      totalLegalCases += item._count._all
      if (item.status === 'CLOSED') {
        resolvedLegalCases += item._count._all
      } else {
        pendingLegalCases += item._count._all
      }
    })

    // 7. R&R summary
    const rrRecordsAgg = await prisma.rRRecord.groupBy({
      by: ['status'],
      where: { parcel: { projectId: id } },
      _count: { _all: true }
    })
    let totalRRFamilies = 0
    let rrCompleted = 0
    let rrInProgress = 0
    let rrNotAssessed = 0

    rrRecordsAgg.forEach(item => {
      totalRRFamilies += item._count._all
      if (item.status === 'COMPLETED') {
        rrCompleted += item._count._all
      } else if (item.status === 'NOT_ASSESSED') {
        rrNotAssessed += item._count._all
      } else {
        rrInProgress += item._count._all
      }
    })

    return NextResponse.json({
      ...project,
      computed: {
        totalParcels: totalParcelsComputed > 0 ? totalParcelsComputed : project.totalParcels,
        acquiredParcels: acquiredCount,
        underProcessParcels: underProcessCount,
        legalDisputeParcels: legalDisputeCount,
        notStartedParcels: notStartedCount,
        overallProgressPercent,
        acquisitionByStatus: acquisitionMap,
        legalByStatus: legalStatusMap,
        rrByStatus: rrStatusMap,
        compensation: {
          assessedAmount: liveAssessedAmount,
          paidAmount: livePaidAmount,
          pendingAmount: livePendingCompensation,
          paidPercentage: liveAssessedAmount > 0
            ? Number(((livePaidAmount / liveAssessedAmount) * 100).toFixed(1))
            : 0
        },
        land: {
          totalAcres: liveTotalLandAcres,
          acquiredAcres: liveAcquiredLandAcres,
          acquiredPercentage: liveTotalLandAcres > 0
            ? Number(((liveAcquiredLandAcres / liveTotalLandAcres) * 100).toFixed(1))
            : 0
        },
        legalCases: {
          total: totalLegalCases,
          resolved: resolvedLegalCases,
          pending: pendingLegalCases
        },
        rr: {
          totalFamilies: totalRRFamilies,
          completed: rrCompleted,
          inProgress: rrInProgress,
          notAssessed: rrNotAssessed
        }
      }
    })
  } catch (error) {
    console.error('Error fetching project details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project details' },
      { status: 500 }
    )
  }
}
