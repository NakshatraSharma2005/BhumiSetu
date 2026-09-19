import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRolePermission } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mis
// Query params:
//   reportType: national_acquisition | state_wise | project_progress |
//               compensation_status | possession_status | rr_status | delayed_projects
//   state: (optional filter)
//   district: (optional filter)
//   projectId: (optional filter)
//   status: (optional filter)
//   dateFrom: (optional ISO date)
//   dateTo: (optional ISO date)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authError = checkRolePermission(request, 'generate:report')
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const reportType = searchParams.get('reportType') ?? 'national_acquisition'
  const stateFilter = searchParams.get('state') || null
  const districtFilter = searchParams.get('district') || null
  const projectIdFilter = searchParams.get('projectId') || null
  const statusFilter = searchParams.get('status') || null
  const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : null
  const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : null

  try {
    // Build base project WHERE clause
    const projectWhere: Record<string, unknown> = {}
    if (stateFilter && stateFilter.toLowerCase() !== 'all') projectWhere.state = stateFilter
    if (districtFilter && districtFilter.toLowerCase() !== 'all') projectWhere.district = districtFilter
    if (projectIdFilter && projectIdFilter.toLowerCase() !== 'all') projectWhere.id = projectIdFilter
    if (statusFilter && statusFilter.toLowerCase() !== 'all') projectWhere.status = statusFilter
    if (dateFrom || dateTo) {
      projectWhere.startDate = {}
      if (dateFrom) (projectWhere.startDate as Record<string, Date>).gte = dateFrom
      if (dateTo) (projectWhere.startDate as Record<string, Date>).lte = dateTo
    }

    switch (reportType) {
      // ── National Acquisition Progress ──────────────────────────────────────
      case 'national_acquisition': {
        const projects = await prisma.project.findMany({
          where: projectWhere,
          select: {
            id: true, name: true, type: true, state: true, district: true,
            status: true, totalParcels: true, landRequiredAcres: true, landAcquiredAcres: true,
            compensationAssessed: true, compensationPaid: true,
            riskLevel: true, riskScore: true, startDate: true, targetDate: true,
            _count: { select: { landParcels: true } },
          },
          orderBy: [{ state: 'asc' }, { name: 'asc' }],
        })

        // Get live parcel counts and compensation per project
        const rows = await Promise.all(projects.map(async (p) => {
          const [parcelGroups, compAgg, rrCount, legalCount] = await Promise.all([
            prisma.landParcel.groupBy({
              by: ['acquisitionStatus'],
              where: { projectId: p.id },
              _count: { _all: true },
            }),
            prisma.compensation.aggregate({
              where: { parcel: { projectId: p.id } },
              _sum: { assessedAmount: true, paidAmount: true },
            }),
            prisma.rRRecord.count({ where: { parcel: { projectId: p.id } } }),
            prisma.legalCase.count({ where: { parcel: { projectId: p.id }, status: { in: ['OPEN', 'UNDER_INVESTIGATION'] } } }),
          ])
          const acquired = parcelGroups.find(g => g.acquisitionStatus === 'ACQUIRED')?._count._all ?? 0
          const total = parcelGroups.reduce((s, g) => s + g._count._all, 0)
          return {
            project: p.name, state: p.state, district: p.district,
            type: p.type, status: p.status,
            landRequired: p.landRequiredAcres, landAcquired: p.landAcquiredAcres,
            acquisitionPct: p.landRequiredAcres > 0
              ? ((p.landAcquiredAcres / p.landRequiredAcres) * 100).toFixed(1)
              : '0',
            totalParcels: total, acquiredParcels: acquired,
            parcelPct: total > 0 ? ((acquired / total) * 100).toFixed(1) : '0',
            compensationAssessed: compAgg._sum.assessedAmount ?? p.compensationAssessed,
            compensationPaid: compAgg._sum.paidAmount ?? p.compensationPaid,
            rrFamilies: rrCount, activeLegalCases: legalCount,
            riskLevel: p.riskLevel,
            startDate: p.startDate?.toISOString().split('T')[0] ?? '',
            targetDate: p.targetDate?.toISOString().split('T')[0] ?? '',
          }
        }))
        return NextResponse.json({ reportType, rows, filters: { stateFilter, districtFilter, statusFilter } })
      }

      // ── State-wise Progress ─────────────────────────────────────────────────
      case 'state_wise': {
        const projects = await prisma.project.findMany({
          where: projectWhere,
          select: {
            id: true, name: true, state: true, district: true, status: true,
            landRequiredAcres: true, landAcquiredAcres: true,
            compensationAssessed: true, compensationPaid: true,
          },
          orderBy: [{ state: 'asc' }],
        })

        // Group by state
        const byState: Record<string, {
          state: string, projects: number,
          landRequired: number, landAcquired: number,
          compensationAssessed: number, compensationPaid: number,
        }> = {}

        for (const p of projects) {
          if (!byState[p.state]) {
            byState[p.state] = {
              state: p.state, projects: 0,
              landRequired: 0, landAcquired: 0,
              compensationAssessed: 0, compensationPaid: 0,
            }
          }
          byState[p.state].projects++
          byState[p.state].landRequired += p.landRequiredAcres
          byState[p.state].landAcquired += p.landAcquiredAcres
          byState[p.state].compensationAssessed += p.compensationAssessed
          byState[p.state].compensationPaid += p.compensationPaid
        }

        const rows = Object.values(byState).map(s => ({
          ...s,
          landRequired: parseFloat(s.landRequired.toFixed(2)),
          landAcquired: parseFloat(s.landAcquired.toFixed(2)),
          acquisitionPct: s.landRequired > 0
            ? ((s.landAcquired / s.landRequired) * 100).toFixed(1) : '0',
          compensationPct: s.compensationAssessed > 0
            ? ((s.compensationPaid / s.compensationAssessed) * 100).toFixed(1) : '0',
        }))

        return NextResponse.json({ reportType, rows, filters: { stateFilter, statusFilter } })
      }

      // ── Project Progress ────────────────────────────────────────────────────
      case 'project_progress': {
        const projects = await prisma.project.findMany({
          where: projectWhere,
          select: {
            id: true, name: true, type: true, state: true, district: true, status: true,
            landRequiredAcres: true, landAcquiredAcres: true,
            compensationAssessed: true, compensationPaid: true,
            riskLevel: true, startDate: true, targetDate: true, totalParcels: true,
          },
          orderBy: { name: 'asc' },
        })

        const rows = await Promise.all(projects.map(async (p) => {
          const [compAgg, rrStats, parcelGroups] = await Promise.all([
            prisma.compensation.aggregate({
              where: { parcel: { projectId: p.id } },
              _sum: { assessedAmount: true, paidAmount: true },
            }),
            prisma.rRRecord.groupBy({
              by: ['status'],
              where: { parcel: { projectId: p.id } },
              _count: { _all: true },
            }),
            prisma.landParcel.groupBy({
              by: ['acquisitionStatus'],
              where: { projectId: p.id },
              _count: { _all: true },
            }),
          ])

          const totalRR = rrStats.reduce((s, g) => s + g._count._all, 0)
          const completedRR = rrStats.find(g => g.status === 'COMPLETED')?._count._all ?? 0
          const acquired = parcelGroups.find(g => g.acquisitionStatus === 'ACQUIRED')?._count._all ?? 0
          const possession = parcelGroups.find(g => g.acquisitionStatus === 'POSSESSION')?._count._all ?? 0
          const legalDispute = parcelGroups.find(g => g.acquisitionStatus === 'LEGAL_DISPUTE')?._count._all ?? 0
          const total = parcelGroups.reduce((s, g) => s + g._count._all, 0)

          const isDelayed = p.targetDate ? new Date(p.targetDate) < new Date() : false

          return {
            project: p.name, type: p.type, state: p.state, district: p.district,
            status: p.status,
            landRequired: p.landRequiredAcres,
            landAcquired: p.landAcquiredAcres,
            acquisitionPct: p.landRequiredAcres > 0
              ? ((p.landAcquiredAcres / p.landRequiredAcres) * 100).toFixed(1) : '0',
            compensationAssessed: compAgg._sum.assessedAmount ?? p.compensationAssessed,
            compensationPaid: compAgg._sum.paidAmount ?? p.compensationPaid,
            totalParcels: total, acquiredParcels: acquired + possession,
            legalDisputeParcels: legalDispute,
            rrFamilies: totalRR, rrCompleted: completedRR,
            rrPct: totalRR > 0 ? ((completedRR / totalRR) * 100).toFixed(1) : '0',
            riskLevel: p.riskLevel,
            startDate: p.startDate?.toISOString().split('T')[0] ?? '',
            targetDate: p.targetDate?.toISOString().split('T')[0] ?? '',
            timelineStatus: isDelayed ? 'DELAYED' : 'ON_TRACK',
          }
        }))
        return NextResponse.json({ reportType, rows, filters: { stateFilter, districtFilter, projectIdFilter, statusFilter } })
      }

      // ── Compensation Status ─────────────────────────────────────────────────
      case 'compensation_status': {
        const projects = await prisma.project.findMany({
          where: projectWhere,
          select: { id: true, name: true, state: true, district: true, status: true },
          orderBy: { name: 'asc' },
        })

        const rows = await Promise.all(projects.map(async (p) => {
          const groups = await prisma.compensation.groupBy({
            by: ['status'],
            where: { parcel: { projectId: p.id } },
            _count: { _all: true },
            _sum: { assessedAmount: true, paidAmount: true },
          })

          const notAssessed = groups.find(g => g.status === 'NOT_ASSESSED')
          const partiallyPaid = groups.find(g => g.status === 'PARTIALLY_PAID')
          const fullyPaid = groups.find(g => g.status === 'FULLY_PAID')

          const totalAssessed = groups.reduce((s, g) => s + (g._sum.assessedAmount ?? 0), 0)
          const totalPaid = groups.reduce((s, g) => s + (g._sum.paidAmount ?? 0), 0)

          return {
            project: p.name, state: p.state, district: p.district, status: p.status,
            notAssessedParcels: notAssessed?._count._all ?? 0,
            partiallyPaidParcels: partiallyPaid?._count._all ?? 0,
            fullyPaidParcels: fullyPaid?._count._all ?? 0,
            totalAssessed, totalPaid,
            totalPending: Math.max(0, totalAssessed - totalPaid),
            paidPct: totalAssessed > 0
              ? ((totalPaid / totalAssessed) * 100).toFixed(1) : '0',
          }
        }))
        return NextResponse.json({ reportType, rows, filters: { stateFilter, districtFilter, projectIdFilter } })
      }

      // ── Possession Status ───────────────────────────────────────────────────
      case 'possession_status': {
        const projects = await prisma.project.findMany({
          where: projectWhere,
          select: { id: true, name: true, state: true, district: true, status: true },
          orderBy: { name: 'asc' },
        })

        const rows = await Promise.all(projects.map(async (p) => {
          const groups = await prisma.landParcel.groupBy({
            by: ['acquisitionStatus'],
            where: { projectId: p.id },
            _count: { _all: true },
            _sum: { areaAcres: true },
          })

          const getG = (status: string) => groups.find(g => g.acquisitionStatus === status)
          const total = groups.reduce((s, g) => s + g._count._all, 0)
          const acquired = (getG('ACQUIRED')?._count._all ?? 0) + (getG('POSSESSION')?._count._all ?? 0)
          const totalAcquiredArea = (getG('ACQUIRED')?._sum.areaAcres ?? 0) + (getG('POSSESSION')?._sum.areaAcres ?? 0)

          return {
            project: p.name, state: p.state, district: p.district, status: p.status,
            totalParcels: total,
            acquiredParcels: acquired,
            possessionParcels: getG('POSSESSION')?._count._all ?? 0,
            legalDisputeParcels: getG('LEGAL_DISPUTE')?._count._all ?? 0,
            notStartedParcels: getG('NOT_STARTED')?._count._all ?? 0,
            verificationParcels: getG('VERIFICATION')?._count._all ?? 0,
            acquisitionPct: total > 0 ? ((acquired / total) * 100).toFixed(1) : '0',
            acquiredAreaAcres: parseFloat(totalAcquiredArea.toFixed(2)),
          }
        }))
        return NextResponse.json({ reportType, rows, filters: { stateFilter, districtFilter, projectIdFilter } })
      }

      // ── R&R Status ──────────────────────────────────────────────────────────
      case 'rr_status': {
        const projects = await prisma.project.findMany({
          where: projectWhere,
          select: { id: true, name: true, state: true, district: true, status: true },
          orderBy: { name: 'asc' },
        })

        const rows = await Promise.all(projects.map(async (p) => {
          const groups = await prisma.rRRecord.groupBy({
            by: ['status'],
            where: { parcel: { projectId: p.id } },
            _count: { _all: true },
          })

          const getG = (status: string) => groups.find(g => g.status === status)?._count._all ?? 0
          const total = groups.reduce((s, g) => s + g._count._all, 0)
          const completed = getG('COMPLETED')

          return {
            project: p.name, state: p.state, district: p.district, status: p.status,
            totalFamilies: total,
            completed, processing: getG('PROCESSING'),
            docsPending: getG('DOCS_PENDING'), eligible: getG('ELIGIBLE'),
            rrPct: total > 0 ? ((completed / total) * 100).toFixed(1) : '0',
          }
        }))
        return NextResponse.json({ reportType, rows, filters: { stateFilter, districtFilter, projectIdFilter } })
      }

      // ── Delayed Projects ────────────────────────────────────────────────────
      case 'delayed_projects': {
        const now = new Date()
        const projects = await prisma.project.findMany({
          where: {
            ...projectWhere,
            OR: [
              { targetDate: { lt: now } },
              { riskLevel: 'HIGH' },
            ],
          },
          select: {
            id: true, name: true, type: true, state: true, district: true, status: true,
            landRequiredAcres: true, landAcquiredAcres: true,
            riskLevel: true, riskScore: true, startDate: true, targetDate: true,
          },
          orderBy: [{ riskScore: 'desc' }, { targetDate: 'asc' }],
        })

        const rows = projects.map(p => {
          const daysOverdue = p.targetDate
            ? Math.max(0, Math.floor((now.getTime() - new Date(p.targetDate).getTime()) / (1000 * 60 * 60 * 24)))
            : 0
          return {
            project: p.name, type: p.type, state: p.state, district: p.district,
            status: p.status, riskLevel: p.riskLevel, riskScore: p.riskScore,
            landRequired: p.landRequiredAcres, landAcquired: p.landAcquiredAcres,
            acquisitionPct: p.landRequiredAcres > 0
              ? ((p.landAcquiredAcres / p.landRequiredAcres) * 100).toFixed(1) : '0',
            targetDate: p.targetDate?.toISOString().split('T')[0] ?? '',
            daysOverdue,
            overdueStatus: daysOverdue > 0 ? `${daysOverdue} days overdue` : 'At Risk (HIGH)',
          }
        })
        return NextResponse.json({ reportType, rows, filters: { stateFilter, statusFilter } })
      }

      default:
        return NextResponse.json({ error: `Unknown reportType: ${reportType}` }, { status: 400 })
    }
  } catch (error: unknown) {
    const err = error as Error
    console.error('MIS report error:', err)
    return NextResponse.json(
      { error: 'Failed to generate report', details: err.message },
      { status: 500 }
    )
  }
}
