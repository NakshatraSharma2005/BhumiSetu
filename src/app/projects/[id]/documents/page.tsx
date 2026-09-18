import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DocumentStatus, DocumentType } from '@/generated/prisma/client'
import { Navbar } from '@/components/Navbar'
import { ProjectDocumentsClient, DocumentItem, DocumentStats } from '@/components/documents/ProjectDocumentsClient'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Building2,
  ExternalLink,
  FileCheck2,
  Layers,
  FileText
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

async function getProjectDocumentsData(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      type: true,
      state: true,
      district: true,
      startDate: true,
      targetDate: true,
      totalParcels: true
    }
  })

  if (!project) return null

  // Fetch all documents for this project's parcels
  const rawDocs = await prisma.document.findMany({
    where: {
      parcel: {
        projectId
      }
    },
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

  // Format documents and calculate stats
  let verifiedCount = 0
  let pendingCount = 0
  let mismatchCount = 0
  const byType: Record<string, number> = {}

  const documents: DocumentItem[] = rawDocs.map((doc) => {
    byType[doc.type] = (byType[doc.type] || 0) + 1

    const dbComp = doc.dbComparisonResult as any
    const isMismatchStatus = doc.status === DocumentStatus.MISMATCH
    const hasMismatchResult =
      dbComp &&
      (dbComp.matches === false ||
        (Array.isArray(dbComp.mismatchedFields) && dbComp.mismatchedFields.length > 0))
    const hasMismatch = isMismatchStatus || Boolean(hasMismatchResult)

    const mismatchedFields: string[] = []
    if (Array.isArray(dbComp?.mismatchedFields)) {
      mismatchedFields.push(...dbComp.mismatchedFields)
    } else if (hasMismatch) {
      mismatchedFields.push('landArea')
    }

    if (hasMismatch) {
      mismatchCount++
    } else if (doc.status === DocumentStatus.VERIFIED) {
      verifiedCount++
    } else {
      pendingCount++
    }

    return {
      id: doc.id,
      type: doc.type,
      status: doc.status as 'PENDING' | 'VERIFIED' | 'MISMATCH',
      hasMismatch,
      mismatchedFields,
      extractedFields: doc.extractedFields,
      dbComparisonResult: doc.dbComparisonResult,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
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

  const stats: DocumentStats = {
    total: rawDocs.length,
    verified: verifiedCount,
    pending: pendingCount,
    mismatch: mismatchCount,
    byType
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      state: project.state,
      district: project.district
    },
    documents,
    stats
  }
}

export default async function ProjectDocumentsPage({ params }: Props) {
  const { id } = await params
  const data = await getProjectDocumentsData(id)

  if (!data) {
    notFound()
  }

  const { project, documents, stats } = data

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation Breadcrumb & Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Project Overview
          </Link>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Project ID:</span>
            <code className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {project.id.slice(0, 8)}...
            </code>
          </div>
        </div>

        {/* Project Header Strip with Sub-Nav */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="outline" className="font-mono text-xs uppercase font-semibold">
                  {project.type}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {project.district ? `${project.district}, ` : ''}{project.state}
                </Badge>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {project.name}
              </h1>
            </div>

            {/* Sub-Nav Action Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/projects/${project.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Dashboard Overview
              </Link>

              <Link
                href={`/projects/${project.id}/map`}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>GIS Land Map</span>
              </Link>

              <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-slate-950 shadow-xs">
                <FileCheck2 className="h-3.5 w-3.5" />
                <span>Documents & OCR Intelligence</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Document Intelligence Client Table */}
        <ProjectDocumentsClient
          project={project}
          initialDocuments={documents}
          initialStats={stats}
        />
      </main>
    </div>
  )
}
