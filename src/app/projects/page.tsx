import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatINR, formatNumber } from '@/lib/utils'
import { MapPin, ArrowRight, Building2, Sparkles } from 'lucide-react'
import { ProjectRiskLevel } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

async function getProjects() {
  return prisma.project.findMany({
    select: {
      id: true, name: true, type: true, state: true, district: true,
      status: true, totalParcels: true, landRequiredAcres: true, landAcquiredAcres: true,
      compensationAssessed: true, compensationPaid: true, riskScore: true, riskLevel: true,
      startDate: true, targetDate: true,
    },
    orderBy: { totalParcels: 'desc' },
  })
}

function riskBadge(level: ProjectRiskLevel | null) {
  switch (level) {
    case ProjectRiskLevel.LOW:
      return <Badge variant="success" className="text-[10px]">On Track</Badge>
    case ProjectRiskLevel.MEDIUM:
      return <Badge variant="warning" className="text-[10px]">At Risk</Badge>
    case ProjectRiskLevel.HIGH:
      return <Badge variant="destructive" className="text-[10px]">Delayed</Badge>
    default:
      return <Badge variant="secondary" className="text-[10px]">Unknown</Badge>
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Infrastructure Projects
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {projects.length} projects · National Land Acquisition Portfolio
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => {
            const landPct = project.landRequiredAcres > 0
              ? Number(((project.landAcquiredAcres / project.landRequiredAcres) * 100).toFixed(1))
              : 0
            const compPct = project.compensationAssessed > 0
              ? Number(((project.compensationPaid / project.compensationAssessed) * 100).toFixed(1))
              : 0
            const isNKIC = project.name.includes('North Karnataka')

            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="block group">
                <Card className={`h-full border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs transition-all group-hover:shadow-md ${isNKIC ? 'border-l-4 border-l-blue-500' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                            {project.name}
                          </span>
                          {isNKIC && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              <Sparkles className="h-2 w-2" />2k
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{project.district}, {project.state}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {riskBadge(project.riskLevel)}
                        <Badge variant="outline" className="text-[10px]">{project.type}</Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-500">Land Acquired</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{landPct}%</span>
                        </div>
                        <Progress value={landPct} className="h-1.5" />
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {formatNumber(Math.round(project.landAcquiredAcres))} / {formatNumber(Math.round(project.landRequiredAcres))} Acres
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-500">Compensation Paid</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{compPct}%</span>
                        </div>
                        <Progress value={compPct} className="h-1.5" indicatorClassName="bg-purple-600 dark:bg-purple-500" />
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {formatINR(project.compensationPaid)} of {formatINR(project.compensationAssessed)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
                      <span>{formatNumber(project.totalParcels)} Parcels</span>
                      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                        View Dashboard <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
