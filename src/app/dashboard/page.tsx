import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ProjectRiskLevel } from '@/generated/prisma/client'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatINR, formatNumber } from '@/lib/utils'
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  MapPin,
  ArrowRight,
  ShieldAlert,
  Users,
  Scale,
  Sparkles
} from 'lucide-react'

// Force dynamic rendering to always query the live database
export const dynamic = 'force-dynamic'

async function getDashboardData() {
  const totalProjects = await prisma.project.count()

  const riskGroups = await prisma.project.groupBy({
    by: ['riskLevel'],
    _count: { _all: true }
  })

  const riskLevelCounts = {
    low: 0,
    medium: 0,
    high: 0
  }

  riskGroups.forEach(item => {
    if (item.riskLevel === ProjectRiskLevel.LOW) riskLevelCounts.low = item._count._all
    if (item.riskLevel === ProjectRiskLevel.MEDIUM) riskLevelCounts.medium = item._count._all
    if (item.riskLevel === ProjectRiskLevel.HIGH) riskLevelCounts.high = item._count._all
  })

  const landSums = await prisma.project.aggregate({
    _sum: {
      landRequiredAcres: true,
      landAcquiredAcres: true
    }
  })

  const compSums = await prisma.compensation.aggregate({
    _sum: {
      assessedAmount: true,
      paidAmount: true
    }
  })
  const projCompSums = await prisma.project.aggregate({
    _sum: {
      compensationAssessed: true,
      compensationPaid: true
    }
  })

  const totalCompensationAssessed = compSums._sum.assessedAmount ?? projCompSums._sum.compensationAssessed ?? 0
  const totalCompensationPaid = compSums._sum.paidAmount ?? projCompSums._sum.compensationPaid ?? 0
  const totalCompensationPending = Math.max(0, totalCompensationAssessed - totalCompensationPaid)

  const totalAffectedFamilies = await prisma.rRRecord.count()
  const totalPendingLegalCases = await prisma.legalCase.count({
    where: {
      status: { in: ['OPEN', 'UNDER_INVESTIGATION'] }
    }
  })

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      state: true,
      district: true,
      status: true,
      startDate: true,
      targetDate: true,
      totalParcels: true,
      landAcquiredAcres: true,
      landRequiredAcres: true,
      compensationAssessed: true,
      compensationPaid: true,
      riskScore: true,
      riskLevel: true
    },
    orderBy: {
      totalParcels: 'desc'
    }
  })

  return {
    totalProjects,
    riskLevelCounts,
    land: {
      totalRequired: landSums._sum.landRequiredAcres ?? 0,
      totalAcquired: landSums._sum.landAcquiredAcres ?? 0,
      percentage: (landSums._sum.landRequiredAcres ?? 0) > 0
        ? Number((((landSums._sum.landAcquiredAcres ?? 0) / (landSums._sum.landRequiredAcres ?? 1)) * 100).toFixed(1))
        : 0
    },
    compensation: {
      totalAssessed: totalCompensationAssessed,
      totalPaid: totalCompensationPaid,
      totalPending: totalCompensationPending,
      percentage: totalCompensationAssessed > 0
        ? Number(((totalCompensationPaid / totalCompensationAssessed) * 100).toFixed(1))
        : 0
    },
    totalAffectedFamilies,
    totalPendingLegalCases,
    projects
  }
}

function getRiskBadge(level: ProjectRiskLevel | null) {
  switch (level) {
    case ProjectRiskLevel.LOW:
      return (
        <Badge variant="success" className="gap-1 font-semibold">
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          On Track
        </Badge>
      )
    case ProjectRiskLevel.MEDIUM:
      return (
        <Badge variant="warning" className="gap-1 font-semibold">
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          At Risk
        </Badge>
      )
    case ProjectRiskLevel.HIGH:
      return (
        <Badge variant="destructive" className="gap-1 font-semibold">
          <ShieldAlert className="h-3 w-3 text-rose-600 dark:text-rose-400" />
          Delayed
        </Badge>
      )
    default:
      return <Badge variant="secondary">Unknown</Badge>
  }
}

function getTypeBadge(type: string) {
  return (
    <Badge variant="outline" className="text-[11px] font-medium border-slate-300 dark:border-slate-700">
      {type}
    </Badge>
  )
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Page Title & Strategic Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                National Land Acquisition Intelligence
              </h1>
              <Badge variant="info" className="hidden sm:inline-flex text-[11px] py-0.5">
                Prisma Live Query
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              Consolidated real-time monitoring across central and state infrastructure projects, cadastral parcel acquisitions, compensation disbursement, and social safeguards.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Monitored Corridor</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatNumber(Math.round(data.land.totalRequired))} <span className="text-xs font-normal text-slate-500">Acres</span>
              </div>
            </div>
          </div>
        </div>

        {/* Primary KPI Cards Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Projects */}
          <Card className="border-l-4 border-l-blue-600 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Projects
              </CardTitle>
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {data.totalProjects}
              </div>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Active across 4 States & Union Territories
              </p>
            </CardContent>
          </Card>

          {/* Project Health / Risk Distribution */}
          <Card className="border-l-4 border-l-amber-500 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Project Health
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {data.riskLevelCounts.low}
                </span>
                <span className="text-xs font-medium text-slate-500">On Track</span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {data.riskLevelCounts.medium}
                </span>
                <span className="text-xs font-medium text-slate-500">At Risk</span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {data.riskLevelCounts.high}
                </span>
                <span className="text-xs font-medium text-slate-500">Delayed</span>
              </div>
              <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div style={{ width: `${(data.riskLevelCounts.low / data.totalProjects) * 100}%` }} className="bg-emerald-500" />
                <div style={{ width: `${(data.riskLevelCounts.medium / data.totalProjects) * 100}%` }} className="bg-amber-500" />
                <div style={{ width: `${(data.riskLevelCounts.high / data.totalProjects) * 100}%` }} className="bg-rose-500" />
              </div>
            </CardContent>
          </Card>

          {/* Land Acquired vs Required */}
          <Card className="border-l-4 border-l-emerald-600 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Land Acquired
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {formatNumber(Math.round(data.land.totalAcquired))} <span className="text-xs font-normal text-slate-500">Acres</span>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {data.land.percentage}%
                </span>
              </div>
              <Progress value={data.land.percentage} className="mt-2.5 h-2" indicatorClassName="bg-emerald-600 dark:bg-emerald-500" />
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Required: {formatNumber(Math.round(data.land.totalRequired))} Acres
              </p>
            </CardContent>
          </Card>

          {/* Compensation Paid vs Assessed */}
          <Card className="border-l-4 border-l-purple-600 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Compensation Disbursed
              </CardTitle>
              <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {formatINR(data.compensation.totalPaid)}
                </div>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                  {data.compensation.percentage}%
                </span>
              </div>
              <Progress value={data.compensation.percentage} className="mt-2.5 h-2" indicatorClassName="bg-purple-600 dark:bg-purple-500" />
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Assessed: {formatINR(data.compensation.totalAssessed)} • Pending: {formatINR(data.compensation.totalPending)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metric Strip: Safeguards & Governance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Social Safeguards (R&R)</div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  {formatNumber(data.totalAffectedFamilies)} Affected Project Families
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              Direct Beneficiaries
            </Badge>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Disputes & Litigations</div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  {data.totalPendingLegalCases} Active Legal / Revenue Disputes
                </div>
              </div>
            </div>
            <Badge variant="destructive" className="text-xs">
              Action Required
            </Badge>
          </div>
        </div>

        {/* Strategic Projects Table & Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Strategic Infrastructure Projects ({data.projects.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any project row or card to launch the comprehensive Project Intelligence Dashboard
              </p>
            </div>
          </div>

          {/* Dense Enterprise Table */}
          <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-slate-900/80">
                <TableRow>
                  <TableHead className="w-[300px]">Project Name & Location</TableHead>
                  <TableHead>Sector / Type</TableHead>
                  <TableHead>Land Acquisition Progress</TableHead>
                  <TableHead>Compensation Disbursement</TableHead>
                  <TableHead>Risk Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.projects.map((project) => {
                  const landPct = project.landRequiredAcres > 0
                    ? Number(((project.landAcquiredAcres / project.landRequiredAcres) * 100).toFixed(1))
                    : 0
                  const compPct = project.compensationAssessed > 0
                    ? Number(((project.compensationPaid / project.compensationAssessed) * 100).toFixed(1))
                    : 0

                  const isNKIC = project.name.includes('North Karnataka')

                  return (
                    <TableRow
                      key={project.id}
                      className={isNKIC ? "bg-blue-50/30 dark:bg-blue-950/10 font-medium hover:bg-blue-50/60" : ""}
                    >
                      <TableCell>
                        <Link href={`/projects/${project.id}`} className="group block">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 transition-colors">
                              {project.name}
                            </span>
                            {isNKIC && (
                              <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                <Sparkles className="h-2.5 w-2.5" />
                                2k Parcels
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <span>{project.district ? `${project.district}, ` : ''}{project.state}</span>
                            <span>•</span>
                            <span>{formatNumber(project.totalParcels)} Total Parcels</span>
                          </div>
                        </Link>
                      </TableCell>

                      <TableCell>
                        {getTypeBadge(project.type)}
                      </TableCell>

                      <TableCell className="w-[200px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {formatNumber(Math.round(project.landAcquiredAcres))} / {formatNumber(Math.round(project.landRequiredAcres))} Ac
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">{landPct}%</span>
                          </div>
                          <Progress value={landPct} className="h-1.5" />
                        </div>
                      </TableCell>

                      <TableCell className="w-[200px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {formatINR(project.compensationPaid)}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">{compPct}%</span>
                          </div>
                          <Progress
                            value={compPct}
                            className="h-1.5"
                            indicatorClassName="bg-purple-600 dark:bg-purple-500"
                          />
                        </div>
                      </TableCell>

                      <TableCell>
                        {getRiskBadge(project.riskLevel)}
                      </TableCell>

                      <TableCell className="text-right">
                        <Link
                          href={`/projects/${project.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                          Dashboard
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      </main>
    </div>
  )
}
