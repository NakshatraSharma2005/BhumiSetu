import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  ArrowRight,
  ClipboardList,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

async function getFieldVerificationTasks() {
  const tasks = await prisma.task.findMany({
    where: { type: 'FIELD_VERIFICATION' },
    include: {
      parcel: {
        select: {
          id: true,
          parcelCode: true,
          village: true,
          district: true,
          state: true,
          areaAcres: true,
          acquisitionStatus: true,
          geometry: true,
        },
      },
      project: {
        select: { id: true, name: true, state: true, district: true },
      },
      fieldVerification: {
        select: { id: true, submittedAt: true, verifierRole: true },
      },
    },
    orderBy: [{ resolved: 'asc' }, { priority: 'asc' }, { daysPending: 'desc' }],
  })

  return tasks
}

function priorityBadge(priority: string) {
  switch (priority) {
    case 'HIGH':
      return (
        <Badge variant="destructive" className="text-[10px] gap-1">
          <AlertTriangle className="h-2.5 w-2.5" /> High
        </Badge>
      )
    case 'MEDIUM':
      return (
        <Badge variant="warning" className="text-[10px] gap-1">
          <Clock className="h-2.5 w-2.5" /> Medium
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          Low
        </Badge>
      )
  }
}

export default async function FieldVerificationListPage() {
  const tasks = await getFieldVerificationTasks()

  const pending = tasks.filter(t => !t.resolved)
  const completed = tasks.filter(t => t.resolved)

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
              <CheckSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Field Verification Tasks
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {pending.length} pending · {completed.length} completed
              </p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {tasks.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Total Tasks</div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-xs">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-400">
                {pending.length}
              </div>
              <div className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">Pending</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20 shadow-xs">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
                {completed.length}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-0.5">Completed</div>
            </CardContent>
          </Card>
        </div>

        {/* Task list */}
        {tasks.length === 0 ? (
          <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-8 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-500">No field verification tasks found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Pending tasks first */}
            {pending.length > 0 && (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pending Verification
                </h2>
                {pending.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </>
            )}

            {/* Completed tasks */}
            {completed.length > 0 && (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pt-2">
                  Completed
                </h2>
                {completed.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Card
// ─────────────────────────────────────────────────────────────────────────────

type Task = Awaited<ReturnType<typeof getFieldVerificationTasks>>[0]

function TaskCard({ task }: { task: Task }) {
  const isResolved = task.resolved
  const hasVerification = !!task.fieldVerification

  // Extract coordinates from parcel geometry for display
  let lat: number | null = null
  let lng: number | null = null
  if (task.parcel?.geometry) {
    const geo = task.parcel.geometry as {
      coordinates?: number[][][]
    }
    const coords = geo.coordinates?.[0]
    if (coords && coords.length > 0) {
      // centroid approximation
      const sumLng = coords.slice(0, -1).reduce((s, c) => s + c[0], 0)
      const sumLat = coords.slice(0, -1).reduce((s, c) => s + c[1], 0)
      const n = coords.length - 1
      lng = parseFloat((sumLng / n).toFixed(5))
      lat = parseFloat((sumLat / n).toFixed(5))
    }
  }

  return (
    <Link href={`/field-verification/${task.id}`} className="block group">
      <div
        className={`rounded-xl border p-4 transition-all group-hover:shadow-md ${
          isResolved
            ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10'
            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Status icon */}
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              isResolved
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                : 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400'
            }`}>
              {isResolved
                ? <CheckCircle2 className="h-4 w-4" />
                : <CheckSquare className="h-4 w-4" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {task.parcel?.parcelCode ?? `Task ${task.description.match(/Task (\d+)/)?.[1] ?? task.id.slice(0, 8)}`}
                </span>
                {priorityBadge(task.priority)}
                {hasVerification && (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Verified
                  </Badge>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {task.description}
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {task.parcel && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {task.parcel.village}, {task.parcel.district}
                  </span>
                )}
                {task.parcel && (
                  <span>{task.parcel.areaAcres} Acres</span>
                )}
                {lat !== null && lng !== null && (
                  <span className="font-mono text-[10px]">
                    {lat}°N, {lng}°E
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {task.daysPending}d pending
                </span>
                {task.project && (
                  <span className="truncate max-w-[200px]">
                    {task.project.name}
                  </span>
                )}
              </div>

              {hasVerification && task.fieldVerification && (
                <div className="mt-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                  Verified by {task.fieldVerification.verifierRole} ·{' '}
                  {new Date(task.fieldVerification.submittedAt).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          </div>

          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 mt-1 group-hover:text-blue-500 transition-colors" />
        </div>
      </div>
    </Link>
  )
}
