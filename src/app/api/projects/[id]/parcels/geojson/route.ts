import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch all parcels for this project with owner and compensation in a single query
    const parcels = await prisma.landParcel.findMany({
      where: { projectId: id },
      select: {
        id: true,
        parcelCode: true,
        surveyNumber: true,
        areaAcres: true,
        village: true,
        district: true,
        state: true,
        geometry: true,
        acquisitionStatus: true,
        legalStatus: true,
        rrStatus: true,
        owner: {
          select: {
            name: true,
            contactInfo: true
          }
        },
        compensation: {
          select: {
            assessedAmount: true,
            paidAmount: true,
            status: true
          }
        }
      },
      orderBy: {
        parcelCode: 'asc'
      }
    })

    // Construct GeoJSON FeatureCollection
    const features = parcels.map((parcel) => {
      const geom = parcel.geometry as any
      const assessed = parcel.compensation?.assessedAmount ?? 0
      const paid = parcel.compensation?.paidAmount ?? 0
      const pending = Math.max(0, assessed - paid)

      return {
        type: 'Feature',
        id: parcel.id,
        geometry: {
          type: geom?.type || 'Polygon',
          coordinates: geom?.coordinates || []
        },
        properties: {
          parcelId: parcel.id,
          parcelCode: parcel.parcelCode,
          surveyNumber: parcel.surveyNumber,
          village: parcel.village,
          district: parcel.district,
          state: parcel.state,
          areaAcres: parcel.areaAcres,
          acquisitionStatus: parcel.acquisitionStatus,
          legalStatus: parcel.legalStatus,
          rrStatus: parcel.rrStatus,
          ownerName: parcel.owner?.name ?? 'Unknown',
          compensationAssessed: assessed,
          compensationPaid: paid,
          compensationPending: pending,
          compensationStatus: parcel.compensation?.status ?? 'NOT_ASSESSED'
        }
      }
    })

    return NextResponse.json({
      type: 'FeatureCollection',
      projectId: project.id,
      projectName: project.name,
      totalFeatures: features.length,
      features
    })
  } catch (error) {
    console.error('Error generating parcels GeoJSON:', error)
    return NextResponse.json(
      { error: 'Failed to generate parcels GeoJSON' },
      { status: 500 }
    )
  }
}
