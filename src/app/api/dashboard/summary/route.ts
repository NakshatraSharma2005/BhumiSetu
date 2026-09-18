import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProjectRiskLevel } from '@/generated/prisma/client'

export async function GET() {
  try {
    const totalProjects = await prisma.project.count()

    // Count by risk level (LOW/MEDIUM/HIGH)
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
      if (item.riskLevel === ProjectRiskLevel.LOW) {
        riskLevelCounts.low = item._count._all
      } else if (item.riskLevel === ProjectRiskLevel.MEDIUM) {
        riskLevelCounts.medium = item._count._all
      } else if (item.riskLevel === ProjectRiskLevel.HIGH) {
        riskLevelCounts.high = item._count._all
      }
    })

    // Total land required & acquired across all projects
    const landSums = await prisma.project.aggregate({
      _sum: {
        landRequiredAcres: true,
        landAcquiredAcres: true
      }
    })

    // Total compensation assessed & paid (from live compensation records or project cache)
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

    // Total affected families (RRRecord count)
    const totalAffectedFamilies = await prisma.rRRecord.count()

    // Total pending legal cases (OPEN or UNDER_INVESTIGATION)
    const totalPendingLegalCases = await prisma.legalCase.count({
      where: {
        status: {
          in: ['OPEN', 'UNDER_INVESTIGATION']
        }
      }
    })

    // Also fetch all projects with core fields for table/card views
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

    return NextResponse.json({
      totalProjects,
      riskLevelCounts: {
        low: riskLevelCounts.low,
        medium: riskLevelCounts.medium,
        high: riskLevelCounts.high,
        // Map to semantic status
        onTrack: riskLevelCounts.low,
        atRisk: riskLevelCounts.medium,
        delayed: riskLevelCounts.high
      },
      land: {
        totalRequiredAcres: Number((landSums._sum.landRequiredAcres ?? 0).toFixed(2)),
        totalAcquiredAcres: Number((landSums._sum.landAcquiredAcres ?? 0).toFixed(2)),
        progressPercentage: (landSums._sum.landRequiredAcres ?? 0) > 0
          ? Number((((landSums._sum.landAcquiredAcres ?? 0) / (landSums._sum.landRequiredAcres ?? 1)) * 100).toFixed(1))
          : 0
      },
      compensation: {
        totalAssessed: totalCompensationAssessed,
        totalPaid: totalCompensationPaid,
        totalPending: Math.max(0, totalCompensationAssessed - totalCompensationPaid),
        paidPercentage: totalCompensationAssessed > 0
          ? Number(((totalCompensationPaid / totalCompensationAssessed) * 100).toFixed(1))
          : 0
      },
      totalAffectedFamilies,
      totalPendingLegalCases,
      projects
    })
  } catch (error) {
    console.error('Error fetching dashboard summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard summary' },
      { status: 500 }
    )
  }
}
