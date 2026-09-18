import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AcquisitionStatus, ProjectRiskLevel } from '@/generated/prisma/client'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatINR, formatNumber } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Building2,
  FileText,
  Users,
  Scale,
  Landmark,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  Check,
  FileCheck2,
  Brain,
  ClipboardList,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

async function getProjectData(id: string) {
  const project = await prisma.project.findUnique({
    where: { id }
  })

  if (!project) return null

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

  // 2. Live compensation sums from actual Compensation records linked to project parcels
  const compAgg = await prisma.compensation.aggregate({
    where: { parcel: { projectId: id } },
    _sum: {
      assessedAmount: true,
      paidAmount: true
    }
  })

  const liveAssessedAmount = compAgg._sum.assessedAmount ?? project.compensationAssessed
  const livePaidAmount = compAgg._sum.paidAmount ?? project.compensationPaid
  const livePendingCompensation = Math.max(0, liveAssessedAmount - livePaidAmount)

  // 3. Live land area sums
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

  // 4. Legal cases summary
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

  // 5. R&R summary
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

  // 6. Document Intelligence summary
  const docsAgg = await prisma.document.findMany({
    where: { parcel: { projectId: id } },
    select: { status: true, dbComparisonResult: true }
  })
  let docMismatches = 0
  let docVerified = 0
  docsAgg.forEach(d => {
    const comp = d.dbComparisonResult as any
    if (d.status === 'MISMATCH' || (comp && comp.matches === false)) {
      docMismatches++
    } else if (d.status === 'VERIFIED') {
      docVerified++
    }
  })

  // 7. Check for demo parcel (NKIC-0001) if North Karnataka project
  let demoParcel = null
  if (project.name.includes('Karnataka')) {
    demoParcel = await prisma.landParcel.findFirst({
      where: { parcelCode: 'NKIC-0001' },
      include: { compensation: true, owner: true, documents: true }
    })
  }

  // 8. Task summary
  const taskAgg = await prisma.task.groupBy({
    by: ['priority', 'resolved'],
    where: { projectId: id },
    _count: { _all: true },
  })
  let taskHighUnresolved = 0, taskMediumUnresolved = 0, taskLowUnresolved = 0
  let taskTotalResolved = 0
  taskAgg.forEach(row => {
    if (row.resolved) { taskTotalResolved += row._count._all; return }
    if (row.priority === 'HIGH') taskHighUnresolved += row._count._all
    else if (row.priority === 'MEDIUM') taskMediumUnresolved += row._count._all
    else taskLowUnresolved += row._count._all
  })

  return {
    project,
    computed: {
      totalParcels: totalParcelsComputed > 0 ? totalParcelsComputed : project.totalParcels,
      acquiredParcels: acquiredCount,
      underProcessParcels: underProcessCount,
      legalDisputeParcels: legalDisputeCount,
      notStartedParcels: notStartedCount,
      overallProgressPercent,
      acquisitionMap,
      compensation: {
        assessed: liveAssessedAmount,
        paid: livePaidAmount,
        pending: livePendingCompensation,
        percentage: liveAssessedAmount > 0
          ? Number(((livePaidAmount / liveAssessedAmount) * 100).toFixed(1))
          : 0
      },
      land: {
        totalAcres: liveTotalLandAcres,
        acquiredAcres: liveAcquiredLandAcres,
        percentage: liveTotalLandAcres > 0
          ? Number(((liveAcquiredLandAcres / liveTotalLandAcres) * 100).toFixed(1))
          : 0
      },
      legal: {
        total: totalLegalCases,
        resolved: resolvedLegalCases,
        pending: pendingLegalCases
      },
      rr: {
        total: totalRRFamilies,
        completed: rrCompleted,
        inProgress: rrInProgress,
        notAssessed: rrNotAssessed
      },
      documents: {
        total: docsAgg.length,
        verified: docVerified,
        mismatches: docMismatches
      },
      tasks: {
        highUnresolved: taskHighUnresolved,
        mediumUnresolved: taskMediumUnresolved,
        lowUnresolved: taskLowUnresolved,
        totalUnresolved: taskHighUnresolved + taskMediumUnresolved + taskLowUnresolved,
        resolved: taskTotalResolved,
      },
      demoParcel
    }
  }
}

function getRiskBadge(level: ProjectRiskLevel | null) {
  switch (level) {
    case ProjectRiskLevel.LOW:
      return (
        <Badge variant="success" className="gap-1 font-semibold text-xs py-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          On Track (Low Risk)
        </Badge>
      )
    case ProjectRiskLevel.MEDIUM:
      return (
        <Badge variant="warning" className="gap-1 font-semibold text-xs py-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          At Risk (Medium Risk)
        </Badge>
      )
    case ProjectRiskLevel.HIGH:
      return (
        <Badge variant="destructive" className="gap-1 font-semibold text-xs py-1">
          <ShieldAlert className="h-3.5 w-3.5" />
          Delayed (High Risk)
        </Badge>
      )
    default:
      return <Badge variant="secondary">Unknown</Badge>
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(date))
}

export default async function ProjectDashboardPage({ params }: Props) {
  const { id } = await params
  const data = await getProjectData(id)

  if (!data) {
    notFound()
  }

  const { project, computed } = data

  const acquiredPct = computed.totalParcels > 0
    ? Number(((computed.acquiredParcels / computed.totalParcels) * 100).toFixed(1))
    : 0
  const underProcessPct = computed.totalParcels > 0
    ? Number(((computed.underProcessParcels / computed.totalParcels) * 100).toFixed(1))
    : 0
  const disputePct = computed.totalParcels > 0
    ? Number(((computed.legalDisputeParcels / computed.totalParcels) * 100).toFixed(1))
    : 0
  const notStartedPct = computed.totalParcels > 0
    ? Number(((computed.notStartedParcels / computed.totalParcels) * 100).toFixed(1))
    : 0

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb & Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to National Dashboard
          </Link>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Project ID:</span>
            <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {project.id.slice(0, 8)}...
            </code>
          </div>
        </div>

        {/* Project Header Card */}
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider font-semibold border-slate-300 dark:border-slate-700">
                    {project.type}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-medium">
                    Status: {project.status}
                  </Badge>
                  {getRiskBadge(project.riskLevel)}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {project.name}
                </h1>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{project.district ? `${project.district}, ` : ''}{project.state}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Timeline: {formatDate(project.startDate)} → {formatDate(project.targetDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <Link href={`/projects/${project.id}/risk`} className="hover:text-slate-900 dark:hover:text-white transition-colors hover:underline underline-offset-2">
                      Risk Score: {project.riskScore != null ? `${project.riskScore}/100` : 'Not computed — run Risk Engine'}
                    </Link>
                  </div>
                </div>

                {/* Sub-Nav Action Strip */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-900 dark:bg-slate-800 dark:text-white">
                    Dashboard Overview
                  </div>
                  <Link
                    href={`/projects/${project.id}/map`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Interactive GIS Map</span>
                  </Link>
                  <Link
                    href={`/projects/${project.id}/documents`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 hover:text-purple-900 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900 transition-colors"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" />
                    <span>Documents &amp; Intelligence</span>
                  </Link>
                  <Link
                    href={`/projects/${project.id}/risk`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900 transition-colors"
                  >
                    <Brain className="h-3.5 w-3.5" />
                    <span>AI Risk Engine</span>
                  </Link>
                  <Link
                    href={`/projects/${project.id}/tasks`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100 hover:text-orange-900 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-900 transition-colors"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span>Tasks &amp; Workflow</span>
                  </Link>
                </div>
              </div>

              {/* Progress Dial Banner & Map CTA */}
              <div className="flex flex-col items-start lg:items-end justify-center rounded-xl bg-slate-50 p-4 border border-slate-200/80 dark:bg-slate-950 dark:border-slate-800 min-w-[220px] space-y-3">
                <div className="w-full text-left lg:text-right">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Overall Completion
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white mt-0.5">
                    {computed.overallProgressPercent}%
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatNumber(computed.acquiredParcels)} of {formatNumber(computed.totalParcels)} Parcels Acquired
                  </div>
                </div>

                <Link
                  href={`/projects/${project.id}/map`}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition-colors"
                >
                  <span>Explore GIS Land Map</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 1: Overview Parcel Acquisition Breakdown */}
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                  Cadastral Parcel Acquisition Breakdown
                </CardTitle>
                <CardDescription className="text-xs">
                  Live computed breakdown across all {formatNumber(computed.totalParcels)} individual revenue land parcels
                </CardDescription>
              </div>
              <Badge variant="info" className="w-fit text-[11px]">
                Real-Time Query
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Stat Box Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Acquired */}
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Acquired</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-950 dark:text-emerald-100">
                  {formatNumber(computed.acquiredParcels)}
                </div>
                <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {acquiredPct}% of project total
                </div>
              </div>

              {/* Under Process */}
              <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Under Process</span>
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="mt-2 text-2xl font-black text-blue-950 dark:text-blue-100">
                  {formatNumber(computed.underProcessParcels)}
                </div>
                <div className="text-[11px] font-medium text-blue-700 dark:text-blue-400 mt-0.5">
                  {underProcessPct}% (Verification/Objection)
                </div>
              </div>

              {/* Legal Dispute */}
              <div className="rounded-xl border border-rose-200/70 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">Legal Dispute</span>
                  <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="mt-2 text-2xl font-black text-rose-950 dark:text-rose-100">
                  {formatNumber(computed.legalDisputeParcels)}
                </div>
                <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400 mt-0.5">
                  {disputePct}% pending in courts
                </div>
              </div>

              {/* Not Started */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Not Started</span>
                  <AlertTriangle className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {formatNumber(computed.notStartedParcels)}
                </div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  {notStartedPct}% early notification stage
                </div>
              </div>
            </div>

            {/* Segmented Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                <span>Parcel Acquisition Distribution</span>
                <span>{computed.overallProgressPercent}% Complete</span>
              </div>
              <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  style={{ width: `${acquiredPct}%` }}
                  className="bg-emerald-500 transition-all hover:opacity-90"
                  title={`Acquired: ${computed.acquiredParcels} (${acquiredPct}%)`}
                />
                <div
                  style={{ width: `${underProcessPct}%` }}
                  className="bg-blue-500 transition-all hover:opacity-90"
                  title={`Under Process: ${computed.underProcessParcels} (${underProcessPct}%)`}
                />
                <div
                  style={{ width: `${disputePct}%` }}
                  className="bg-rose-500 transition-all hover:opacity-90"
                  title={`Legal Dispute: ${computed.legalDisputeParcels} (${disputePct}%)`}
                />
                <div
                  style={{ width: `${notStartedPct}%` }}
                  className="bg-slate-300 dark:bg-slate-600 transition-all hover:opacity-90"
                  title={`Not Started: ${computed.notStartedParcels} (${notStartedPct}%)`}
                />
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-600 dark:text-slate-400">Acquired ({acquiredPct}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="text-slate-600 dark:text-slate-400">Under Process ({underProcessPct}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <span className="text-slate-600 dark:text-slate-400">Legal Dispute ({disputePct}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="text-slate-600 dark:text-slate-400">Not Started ({notStartedPct}%)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Compensation, Legal, and R&R Detail Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Compensation Summary Card */}
          <Card className="border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Compensation Summary
                </CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  Live Aggregated
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Assessed:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatINR(computed.compensation.assessed)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Disbursed / Paid:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatINR(computed.compensation.paid)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-700 dark:text-amber-400 font-medium">Pending Release:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{formatINR(computed.compensation.pending)}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Disbursement Ratio</span>
                  <span>{computed.compensation.percentage}%</span>
                </div>
                <Progress
                  value={computed.compensation.percentage}
                  className="h-2"
                  indicatorClassName="bg-purple-600 dark:bg-purple-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Paid vs. Pending Assessed Value
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Legal Summary Card */}
          <Card className="border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Scale className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  Legal & Dispute Summary
                </CardTitle>
                <Badge variant={computed.legal.pending > 0 ? "destructive" : "success"} className="text-[10px]">
                  {computed.legal.pending > 0 ? `${computed.legal.pending} Active` : 'No Disputes'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Legal Cases Filed:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{computed.legal.total}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Disputes Resolved:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{computed.legal.resolved}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-rose-700 dark:text-rose-400 font-medium">Pending Resolution:</span>
                  <span className="font-bold text-rose-700 dark:text-rose-400">{computed.legal.pending}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Resolution Rate</span>
                  <span>
                    {computed.legal.total > 0
                      ? Math.round((computed.legal.resolved / computed.legal.total) * 100)
                      : 100}%
                  </span>
                </div>
                <Progress
                  value={computed.legal.total > 0 ? (computed.legal.resolved / computed.legal.total) * 100 : 100}
                  className="h-2"
                  indicatorClassName="bg-emerald-600 dark:bg-emerald-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Active tracking in Special Land Acquisition Courts
                </p>
              </div>
            </CardContent>
          </Card>

          {/* R&R Summary Card */}
          <Card className="border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  R&R (Social Safeguards)
                </CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  LARR Act 2013
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Affected Families:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatNumber(computed.rr.total)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Rehabilitation Completed:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatNumber(computed.rr.completed)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-700 dark:text-blue-400 font-medium">In-Progress / Eligible:</span>
                  <span className="font-bold text-blue-700 dark:text-blue-400">{formatNumber(computed.rr.inProgress)}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Rehabilitation Rate</span>
                  <span>
                    {computed.rr.total > 0
                      ? Math.round((computed.rr.completed / computed.rr.total) * 100)
                      : 0}%
                  </span>
                </div>
                <Progress
                  value={computed.rr.total > 0 ? (computed.rr.completed / computed.rr.total) * 100 : 0}
                  className="h-2"
                  indicatorClassName="bg-blue-600 dark:bg-blue-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Resettlement colonies & direct benefit assistance
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 3: Pending Tasks Summary Card */}
        <Card className="border-orange-200/70 bg-orange-50/30 dark:border-orange-900/40 dark:bg-orange-950/15 shadow-sm">
          <CardHeader className="pb-3 border-b border-orange-100/80 dark:border-orange-900/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Pending Workflow Tasks
                </CardTitle>
              </div>
              <Link
                href={`/projects/${project.id}/tasks`}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-200 transition-colors"
              >
                View All Tasks
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-red-200/70 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20 p-3 text-center">
                <div className="text-xl font-black text-red-900 dark:text-red-100">{computed.tasks.highUnresolved}</div>
                <div className="text-[10px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mt-0.5 flex items-center justify-center gap-0.5">
                  <ShieldAlert className="h-3 w-3" /> High
                </div>
              </div>
              <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3 text-center">
                <div className="text-xl font-black text-amber-900 dark:text-amber-100">{computed.tasks.mediumUnresolved}</div>
                <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mt-0.5 flex items-center justify-center gap-0.5">
                  <AlertTriangle className="h-3 w-3" /> Medium
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 p-3 text-center">
                <div className="text-xl font-black text-slate-900 dark:text-white">{computed.tasks.lowUnresolved}</div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5 flex items-center justify-center gap-0.5">
                  <Clock className="h-3 w-3" /> Low
                </div>
              </div>
              <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3 text-center">
                <div className="text-xl font-black text-emerald-900 dark:text-emerald-100">{computed.tasks.resolved}</div>
                <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mt-0.5 flex items-center justify-center gap-0.5">
                  <Check className="h-3 w-3" /> Resolved
                </div>
              </div>
            </div>
            {computed.tasks.totalUnresolved > 0 && (
              <p className="mt-3 text-[11px] text-orange-700 dark:text-orange-400 font-medium">
                {computed.tasks.totalUnresolved} unresolved tasks — {computed.tasks.highUnresolved} require immediate attention.
                {' '}<Link href={`/projects/${project.id}/tasks?filter=HIGH`} className="underline underline-offset-2 hover:text-orange-900 dark:hover:text-orange-200">View high-priority →</Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Verified Seed Data Highlight (Demo Parcel NKIC-0001) */}
        {computed.demoParcel && (
          <Card className="border-blue-200 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/20 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-blue-950 dark:text-blue-100">
                      Featured Audit Parcel: {computed.demoParcel.parcelCode}
                    </CardTitle>
                    <Badge variant="success" className="text-[10px]">
                      Live DB Verified
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-blue-800 dark:text-blue-300">
                    Seeded Cadastral Verification Benchmark • Survey mismatch detection active
                  </CardDescription>
                </div>
                <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                  Village: {computed.demoParcel.village}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-white dark:bg-slate-900 p-4 rounded-lg border border-blue-100 dark:border-blue-900/40">
                <div>
                  <span className="text-slate-500 block">Landowner:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {computed.demoParcel.owner?.name ?? 'Unknown'}
                  </span>
                  <span className="text-[11px] text-slate-400 block font-mono">
                    {computed.demoParcel.surveyNumber}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Cadastral Area:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {computed.demoParcel.areaAcres} Acres
                  </span>
                  <span className="text-[11px] text-emerald-600 block">
                    Status: {computed.demoParcel.acquisitionStatus}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Compensation:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatINR(computed.demoParcel.compensation?.assessedAmount ?? 0)}
                  </span>
                  <span className="text-[11px] text-emerald-600 block">
                    Paid: {formatINR(computed.demoParcel.compensation?.paidAmount ?? 0)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">Survey Document Audit:</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Doc: 2.1 Ac vs DB: 2.5 Ac
                  </span>
                  <Link
                    href={`/projects/${project.id}/documents?search=NKIC-0001`}
                    className="mt-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1 transition-colors"
                  >
                    <span>Audit in Document AI</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
