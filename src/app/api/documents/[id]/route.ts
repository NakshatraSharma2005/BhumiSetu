import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DocumentStatus } from '@/generated/prisma/client'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        parcel: {
          include: {
            owner: true,
            project: {
              select: {
                id: true,
                name: true,
                type: true,
                state: true,
                district: true
              }
            },
            compensation: true,
            legalCases: {
              where: { status: 'OPEN' }
            }
          }
        }
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const parcel = document.parcel
    const owner = parcel.owner
    const extracted = (document.extractedFields as Record<string, any>) || {}
    const dbComparison = (document.dbComparisonResult as Record<string, any>) || {}

    // Determine extracted land area
    let extractedArea: number | null = null
    if (extracted.landArea !== undefined && extracted.landArea !== null) {
      extractedArea = Number(extracted.landArea)
    } else if (extracted.area !== undefined && extracted.area !== null) {
      extractedArea = Number(extracted.area)
    }

    // Determine extracted owner name
    const extractedOwner = extracted.ownerName || extracted.name || null

    // Determine extracted survey number / date
    const extractedSurveyDate = extracted.surveyDate || extracted.date || null
    const extractedDistrict = extracted.district || null
    const extractedTaluka = extracted.taluka || extracted.village || null

    // Build field-by-field audit comparison list
    interface FieldAudit {
      field: string
      label: string
      dbValue: string
      extractedValue: string
      isMatch: boolean
      difference?: string
    }

    const comparisons: FieldAudit[] = []

    // 1. Land Area Comparison
    if (extractedArea !== null && !isNaN(extractedArea)) {
      const dbArea = Number(parcel.areaAcres.toFixed(2))
      const extArea = Number(extractedArea.toFixed(2))
      const diff = Number((extArea - dbArea).toFixed(2))
      const isMatch = Math.abs(diff) < 0.01

      let diffText = ''
      if (!isMatch) {
        const pct = ((diff / dbArea) * 100).toFixed(1)
        diffText = `${diff > 0 ? '+' : ''}${diff} acres (${diff > 0 ? '+' : ''}${pct}%)`
      }

      comparisons.push({
        field: 'landArea',
        label: 'Land Area (Acres)',
        dbValue: `${dbArea} acres`,
        extractedValue: `${extArea} acres`,
        isMatch,
        difference: diffText || undefined
      })
    } else {
      comparisons.push({
        field: 'landArea',
        label: 'Land Area (Acres)',
        dbValue: `${parcel.areaAcres} acres`,
        extractedValue: 'Not specified in document',
        isMatch: true
      })
    }

    // 2. Owner Name Comparison
    if (extractedOwner) {
      const dbNameNorm = owner.name.trim().toLowerCase()
      const extNameNorm = String(extractedOwner).trim().toLowerCase()
      const isMatch = dbNameNorm === extNameNorm

      comparisons.push({
        field: 'ownerName',
        label: 'Landowner Name',
        dbValue: owner.name,
        extractedValue: String(extractedOwner),
        isMatch,
        difference: !isMatch ? 'Name discrepancy detected' : undefined
      })
    } else {
      comparisons.push({
        field: 'ownerName',
        label: 'Landowner Name',
        dbValue: owner.name,
        extractedValue: 'Not specified in document',
        isMatch: true
      })
    }

    // 3. District Comparison
    if (extractedDistrict) {
      const isMatch = parcel.district.toLowerCase() === String(extractedDistrict).toLowerCase()
      comparisons.push({
        field: 'district',
        label: 'District',
        dbValue: parcel.district,
        extractedValue: String(extractedDistrict),
        isMatch,
        difference: !isMatch ? 'District does not match' : undefined
      })
    }

    // 4. Village / Taluka Comparison
    if (extractedTaluka) {
      const isMatch = parcel.village.toLowerCase().includes(String(extractedTaluka).toLowerCase()) ||
                      String(extractedTaluka).toLowerCase().includes(parcel.village.toLowerCase())
      comparisons.push({
        field: 'village',
        label: 'Village / Taluka',
        dbValue: parcel.village,
        extractedValue: String(extractedTaluka),
        isMatch,
        difference: !isMatch ? 'Sub-district jurisdiction variance' : undefined
      })
    }

    // 5. Survey Number & Date
    comparisons.push({
      field: 'surveyNumber',
      label: 'Cadastral Survey No.',
      dbValue: parcel.surveyNumber,
      extractedValue: extracted.surveyNumber ? String(extracted.surveyNumber) : parcel.surveyNumber,
      isMatch: true
    })

    if (extractedSurveyDate) {
      comparisons.push({
        field: 'surveyDate',
        label: 'Document / Survey Date',
        dbValue: 'Registered in Record of Rights',
        extractedValue: String(extractedSurveyDate),
        isMatch: true
      })
    }

    const hasMismatch = document.status === DocumentStatus.MISMATCH ||
      comparisons.some(c => !c.isMatch) ||
      dbComparison.matches === false

    const mismatchedFieldsList = comparisons
      .filter(c => !c.isMatch)
      .map(c => c.field)

    return NextResponse.json({
      id: document.id,
      type: document.type,
      status: document.status,
      hasMismatch,
      mismatchedFields: mismatchedFieldsList.length > 0 ? mismatchedFieldsList : (dbComparison.mismatchedFields || []),
      extractedFields: document.extractedFields,
      dbComparisonResult: document.dbComparisonResult,
      comparisons,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      parcel: {
        id: parcel.id,
        parcelCode: parcel.parcelCode,
        surveyNumber: parcel.surveyNumber,
        village: parcel.village,
        district: parcel.district,
        state: parcel.state,
        areaAcres: parcel.areaAcres,
        acquisitionStatus: parcel.acquisitionStatus,
        legalStatus: parcel.legalStatus,
        rrStatus: parcel.rrStatus,
        owner: {
          id: owner.id,
          name: owner.name,
          contactInfo: owner.contactInfo
        },
        project: parcel.project,
        compensation: parcel.compensation,
        hasOpenDisputes: parcel.legalCases.length > 0
      }
    })
  } catch (error: any) {
    console.error('Error fetching document details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch document details', details: error.message },
      { status: 500 }
    )
  }
}
