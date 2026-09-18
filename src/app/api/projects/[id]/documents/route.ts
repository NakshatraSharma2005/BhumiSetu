import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DocumentType, DocumentStatus } from '@/generated/prisma/client'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, state: true, district: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const typeParam = searchParams.get('type')
    const searchQuery = searchParams.get('search')?.trim()
    const mismatchOnly = searchParams.get('mismatchOnly') === 'true'

    // Build Prisma where filter for all documents belonging to this project's parcels
    const where: any = {
      parcel: {
        projectId: id
      }
    }

    if (typeParam && typeParam !== 'ALL' && Object.values(DocumentType).includes(typeParam as DocumentType)) {
      where.type = typeParam as DocumentType
    }

    if (statusParam && statusParam !== 'ALL' && Object.values(DocumentStatus).includes(statusParam as DocumentStatus)) {
      where.status = statusParam as DocumentStatus
    }

    if (searchQuery) {
      where.OR = [
        { parcel: { parcelCode: { contains: searchQuery, mode: 'insensitive' } } },
        { parcel: { surveyNumber: { contains: searchQuery, mode: 'insensitive' } } },
        { parcel: { owner: { name: { contains: searchQuery, mode: 'insensitive' } } } },
        { id: { contains: searchQuery, mode: 'insensitive' } }
      ]
    }

    // Fetch all project documents matching the base filters
    const rawDocuments = await prisma.document.findMany({
      where,
      include: {
        parcel: {
          select: {
            id: true,
            parcelCode: true,
            surveyNumber: true,
            village: true,
            district: true,
            state: true,
            areaAcres: true,
            acquisitionStatus: true,
            owner: {
              select: {
                id: true,
                name: true,
                contactInfo: true
              }
            }
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    })

    // Compute mismatch flag and format each document
    const formattedDocs = rawDocuments.map(doc => {
      const dbComp = doc.dbComparisonResult as any
      const isMismatchStatus = doc.status === DocumentStatus.MISMATCH
      const hasMismatchResult = dbComp && (dbComp.matches === false || (Array.isArray(dbComp.mismatchedFields) && dbComp.mismatchedFields.length > 0))
      const hasMismatch = isMismatchStatus || Boolean(hasMismatchResult)

      const mismatchedFields: string[] = []
      if (Array.isArray(dbComp?.mismatchedFields)) {
        mismatchedFields.push(...dbComp.mismatchedFields)
      } else if (hasMismatch && mismatchedFields.length === 0) {
        mismatchedFields.push('landArea')
      }

      return {
        id: doc.id,
        type: doc.type,
        status: doc.status,
        hasMismatch,
        mismatchedFields,
        extractedFields: doc.extractedFields,
        dbComparisonResult: doc.dbComparisonResult,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        parcel: {
          id: doc.parcel.id,
          parcelCode: doc.parcel.parcelCode,
          surveyNumber: doc.parcel.surveyNumber,
          village: doc.parcel.village,
          district: doc.parcel.district,
          state: doc.parcel.state,
          areaAcres: doc.parcel.areaAcres,
          acquisitionStatus: doc.parcel.acquisitionStatus,
          ownerName: doc.parcel.owner?.name || 'Unknown',
          contactInfo: doc.parcel.owner?.contactInfo
        }
      }
    })

    // Apply mismatchOnly filter if requested
    const filteredDocs = mismatchOnly
      ? formattedDocs.filter(d => d.hasMismatch)
      : formattedDocs

    // Calculate project-wide statistics across all documents
    const allProjectDocs = await prisma.document.findMany({
      where: {
        parcel: { projectId: id }
      },
      select: {
        id: true,
        type: true,
        status: true,
        dbComparisonResult: true
      }
    })

    let verifiedCount = 0
    let pendingCount = 0
    let mismatchCount = 0
    const byType: Record<string, number> = {}

    for (const d of allProjectDocs) {
      byType[d.type] = (byType[d.type] || 0) + 1

      const comp = d.dbComparisonResult as any
      const isMismatch = d.status === DocumentStatus.MISMATCH || (comp && (comp.matches === false || (Array.isArray(comp.mismatchedFields) && comp.mismatchedFields.length > 0)))

      if (isMismatch) {
        mismatchCount++
      } else if (d.status === DocumentStatus.VERIFIED) {
        verifiedCount++
      } else {
        pendingCount++
      }
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        type: project.type,
        state: project.state,
        district: project.district
      },
      stats: {
        total: allProjectDocs.length,
        verified: verifiedCount,
        pending: pendingCount,
        mismatch: mismatchCount,
        byType
      },
      documents: filteredDocs
    })
  } catch (error: any) {
    console.error('Error fetching project documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project documents', details: error.message },
      { status: 500 }
    )
  }
}
