import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
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
        riskLevel: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        totalParcels: 'desc'
      }
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}
