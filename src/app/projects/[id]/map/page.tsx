import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/Navbar'
import { ProjectMapClient } from '@/components/map/ProjectMapClient'

interface Props {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true }
  })

  return {
    title: project ? `${project.name} | GIS Land Map • BhūmiSetu` : 'GIS Land Map • BhūmiSetu',
    description: 'Cadastral GIS parcel map layer with live acquisition status, boundaries, and compensation awards.'
  }
}

export default async function ProjectMapPage({ params }: Props) {
  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      state: true,
      district: true,
      totalParcels: true
    }
  })

  if (!project) {
    notFound()
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <Navbar />
      <main className="flex-1 flex flex-col w-full overflow-hidden">
        <ProjectMapClient
          projectId={project.id}
          projectName={project.name}
          projectType={project.type}
          state={project.state}
          district={project.district}
          totalParcels={project.totalParcels}
        />
      </main>
    </div>
  )
}
