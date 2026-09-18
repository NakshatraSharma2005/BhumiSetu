import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeProjectRisk } from '@/lib/services/risk-engine'
import { getRecommendations } from '@/lib/services/recommendations'
import { ProjectRiskLevel } from '@/generated/prisma/client'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, state: true, district: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // ── Compute risk (all Prisma queries run inside the engine) ─────────────
    const riskResult = await computeProjectRisk(id)

    // ── Generate recommendations ────────────────────────────────────────────
    const recommendations = getRecommendations(riskResult)

    // ── Write-back: persist score + level to Project table ──────────────────
    // This keeps project dashboard header ("Risk Score: X/10") in sync.
    const prismaLevel =
      riskResult.riskLevel === 'LOW'
        ? ProjectRiskLevel.LOW
        : riskResult.riskLevel === 'MEDIUM'
        ? ProjectRiskLevel.MEDIUM
        : ProjectRiskLevel.HIGH

    await prisma.project.update({
      where: { id },
      data: {
        riskScore: riskResult.overallScore,
        riskLevel: prismaLevel,
      },
    })

    return NextResponse.json({
      project,
      risk: {
        overallScore: riskResult.overallScore,
        riskLevel: riskResult.riskLevel,
        dominantFactor: riskResult.dominantFactor,
        computedAt: riskResult.computedAt,
        factors: riskResult.factors,
      },
      recommendations,
    })
  } catch (error: any) {
    console.error('Risk engine error:', error)
    return NextResponse.json(
      { error: 'Failed to compute risk score', details: error.message },
      { status: 500 }
    )
  }
}
