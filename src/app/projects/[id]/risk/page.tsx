import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { computeProjectRisk } from '@/lib/services/risk-engine'
import { getRecommendations } from '@/lib/services/recommendations'
import { ProjectRiskLevel } from '@/generated/prisma/client'
import { Navbar } from '@/components/Navbar'
import RiskDashboardClient from '@/components/risk/RiskDashboardClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RiskDashboardPage({ params }: Props) {
  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      state: true,
      district: true,
      status: true,
      targetDate: true,
    },
  })

  if (!project) notFound()

  // Compute directly — no HTTP self-request (Next.js App Router best practice)
  const riskResult = await computeProjectRisk(id)
  const recommendations = getRecommendations(riskResult)

  // Write-back persisted risk score so dashboard header is in sync
  const prismaLevel =
    riskResult.riskLevel === 'LOW'
      ? ProjectRiskLevel.LOW
      : riskResult.riskLevel === 'MEDIUM'
      ? ProjectRiskLevel.MEDIUM
      : ProjectRiskLevel.HIGH

  await prisma.project.update({
    where: { id },
    data: { riskScore: riskResult.overallScore, riskLevel: prismaLevel },
  })

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Navbar />
      <RiskDashboardClient
        project={{
          id: project.id,
          name: project.name,
          type: project.type,
          state: project.state,
          district: project.district,
          status: project.status,
          targetDate: project.targetDate.toISOString(),
        }}
        riskResult={{
          overallScore: riskResult.overallScore,
          riskLevel: riskResult.riskLevel,
          dominantFactor: riskResult.dominantFactor,
          computedAt: riskResult.computedAt,
          factors: riskResult.factors,
        }}
        recommendations={recommendations}
      />
    </div>
  )
}
