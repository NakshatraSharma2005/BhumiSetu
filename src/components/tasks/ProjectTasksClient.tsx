'use client'

import Link from 'next/link'
import { useState, useCallback } from 'react'
import { useRole } from '@/context/RoleContext'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ExternalLink,
  FileCheck2,
  Brain,
  Check,
  Loader2,
  RefreshCw,
  ClipboardList,
  MapPin,
  User,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Undo2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TaskParcel {
  id: string
  parcelCode: string
  village: string
  district: string
}

interface TaskAssignee {
  id: string
  name: string
  role: string
}

export interface Task {
  id: string
  type: string
  description: string
  responsibleRole: string
  dueDate: string | null
  daysPending: number
  priority: string
  resolved: boolean
  createdAt: string
  parcel: TaskParcel | null
  assignee: TaskAssignee | null
}

interface ProjectInfo {
  id: string
  name: string
  type: string
  state: string
  district: string
  status: string
}

interface Stats {
  total: number
  unresolved: number
  resolved: number
  byPriority: { HIGH: number; MEDIUM: number; LOW: number }
  maxDaysPending: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type FilterMode = 'ALL' | 'UNRESOLVED' | 'HIGH'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(iso))
}

function formatTaskType(type: string) {
  return type.replace(/_/g, ' ')
}

function formatRole(role: string) {
  return role.replace(/_/g, ' ')
}

function priorityConfig(priority: string) {
  switch (priority) {
    case 'HIGH':
      return {
        badge: 'destructive' as const,
        icon: <ShieldAlert className="h-3 w-3" />,
        bar: 'bg-red-500',
        text: 'text-red-700 dark:text-red-400',
        ring: 'ring-red-200 dark:ring-red-900/50',
      }
    case 'MEDIUM':
      return {
        badge: 'warning' as const,
        icon: <AlertTriangle className="h-3 w-3" />,
        bar: 'bg-amber-500',
        text: 'text-amber-700 dark:text-amber-400',
        ring: 'ring-amber-200 dark:ring-amber-900/50',
      }
    default:
      return {
        badge: 'secondary' as const,
        icon: <Clock className="h-3 w-3" />,
        bar: 'bg-slate-400',
        text: 'text-slate-600 dark:text-slate-400',
        ring: 'ring-slate-200 dark:ring-slate-700',
      }
  }
}

function pendingColor(days: number) {
  if (days >= 40) return 'text-red-600 dark:text-red-400 font-bold'
  if (days >= 20) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-slate-600 dark:text-slate-400'
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Row Component
// ─────────────────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  toggling,
}: {
  task: Task
  onToggle: (id: string) => void
  toggling: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const pc = priorityConfig(task.priority)

  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${
        task.resolved
          ? 'border-slate-200/60 bg-slate-50/40 opacity-70 dark:border-slate-800/60 dark:bg-slate-900/30'
          : `border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900`
      }`}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        {/* Priority indicator strip */}
        <div className={`flex-shrink-0 mt-1 w-1 self-stretch rounded-full ${task.resolved ? 'bg-slate-200 dark:bg-slate-700' : pc.bar}`} />

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={task.resolved ? 'secondary' : pc.badge} className="text-[10px] gap-0.5 py-0 px-1.5">
              {pc.icon}
              {task.priority}
            </Badge>
            <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {formatTaskType(task.type)}
            </span>
            {task.resolved && (
              <Badge variant="success" className="text-[10px] gap-0.5 py-0 px-1.5">
                <Check className="h-3 w-3" />
                Resolved
              </Badge>
            )}
          </div>

          <p className="text-sm text-slate-800 dark:text-slate-200 leading-snug">
            {task.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {formatRole(task.responsibleRole)}
            </span>
            {task.parcel && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {task.parcel.parcelCode} · {task.parcel.village}
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Due: {formatDate(task.dueDate)}
            </span>
            <span className={`flex items-center gap-1 ${pendingColor(task.daysPending)}`}>
              <Clock className="h-3 w-3" />
              {task.daysPending}d pending
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <button
            onClick={() => onToggle(task.id)}
            disabled={toggling}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
              task.resolved
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
            } disabled:opacity-50`}
          >
            {toggling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : task.resolved ? (
              <Undo2 className="h-3 w-3" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            {task.resolved ? 'Reopen' : 'Mark Resolved'}
          </button>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 pb-4 pt-3 bg-slate-50/60 dark:bg-slate-900/40 rounded-b-lg">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5">Task ID</span>
              <code className="font-mono text-[10px] bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {task.id.slice(0, 12)}…
              </code>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Created</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(task.createdAt)}</span>
            </div>
            {task.assignee && (
              <div>
                <span className="text-slate-400 block mb-0.5">Assignee</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {task.assignee.name} ({formatRole(task.assignee.role)})
                </span>
              </div>
            )}
            {task.parcel && (
              <div>
                <span className="text-slate-400 block mb-0.5">Parcel</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {task.parcel.parcelCode} · {task.parcel.district}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Client Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectTasksClient({
  project,
  initialTasks,
  stats: initialStats,
}: {
  project: ProjectInfo
  initialTasks: Task[]
  stats: Stats
}) {
  const { activeRole } = useRole()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [filter, setFilter] = useState<FilterMode>('ALL')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Recompute stats from live task state
  const stats: Stats = {
    total: tasks.length,
    unresolved: tasks.filter(t => !t.resolved).length,
    resolved: tasks.filter(t => t.resolved).length,
    byPriority: {
      HIGH: tasks.filter(t => !t.resolved && t.priority === 'HIGH').length,
      MEDIUM: tasks.filter(t => !t.resolved && t.priority === 'MEDIUM').length,
      LOW: tasks.filter(t => !t.resolved && t.priority === 'LOW').length,
    },
    maxDaysPending: tasks
      .filter(t => !t.resolved)
      .reduce((max, t) => Math.max(max, t.daysPending), 0),
  }

  // Filtered view
  const filtered = tasks.filter(t => {
    if (filter === 'UNRESOLVED') return !t.resolved
    if (filter === 'HIGH') return !t.resolved && t.priority === 'HIGH'
    return true
  })

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  const handleToggle = useCallback(async (taskId: string) => {
    setTogglingId(taskId)
    // Optimistic update
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, resolved: !t.resolved } : t)
    )
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'x-demo-role': activeRole },
      })
      if (!res.ok) throw new Error('Server error')
      const updated = await res.json()
      // Sync with server truth
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, resolved: updated.resolved } : t)
      )
      showToast(
        updated.resolved ? 'Task marked as resolved ✓' : 'Task reopened',
        'success'
      )
    } catch {
      // Revert optimistic update
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { ...t, resolved: !t.resolved } : t)
      )
      showToast('Failed to update task. Please try again.', 'error')
    } finally {
      setTogglingId(null)
    }
  }, [showToast])

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">

      {/* ── Breadcrumb + Nav ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Project Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${project.id}/map`}
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 transition-colors">
            <ExternalLink className="h-3 w-3" />GIS Map
          </Link>
          <Link href={`/projects/${project.id}/documents`}
            className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 transition-colors">
            <FileCheck2 className="h-3 w-3" />Documents
          </Link>
          <Link href={`/projects/${project.id}/risk`}
            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 transition-colors">
            <Brain className="h-3 w-3" />Risk Engine
          </Link>
        </div>
      </div>

      {/* ── Hero Header ── */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">{project.type}</Badge>
              <Badge variant="secondary" className="text-[10px]">Tasks &amp; Workflow</Badge>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Workflow Management
            </h1>
            <p className="text-sm text-slate-500">{project.name} · {project.district}, {project.state}</p>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-red-200/70 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20 px-4 py-3 text-center">
              <div className="text-2xl font-black text-red-900 dark:text-red-100">{stats.byPriority.HIGH}</div>
              <div className="text-[10px] font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mt-0.5">High Priority</div>
            </div>
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 px-4 py-3 text-center">
              <div className="text-2xl font-black text-amber-900 dark:text-amber-100">{stats.unresolved}</div>
              <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mt-0.5">Unresolved</div>
            </div>
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-4 py-3 text-center">
              <div className="text-2xl font-black text-emerald-900 dark:text-emerald-100">{stats.resolved}</div>
              <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mt-0.5">Resolved</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 px-4 py-3 text-center">
              <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.maxDaysPending}d</div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5">Max Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Bar + Task List ── */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-slate-500" />
                Task List
              </CardTitle>
              <CardDescription className="text-xs">
                {filtered.length} of {tasks.length} tasks shown · Click a row to expand details
              </CardDescription>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['ALL', 'UNRESOLVED', 'HIGH'] as FilterMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setFilter(mode)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    filter === mode
                      ? mode === 'HIGH'
                        ? 'bg-red-600 text-white shadow-sm'
                        : mode === 'UNRESOLVED'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  {mode === 'ALL' && `All (${tasks.length})`}
                  {mode === 'UNRESOLVED' && `Unresolved (${stats.unresolved})`}
                  {mode === 'HIGH' && `High Priority (${stats.byPriority.HIGH})`}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CheckCircle2 className="h-10 w-10 mb-3 text-emerald-400" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No tasks match this filter</p>
              <p className="text-xs mt-1">All tasks in this category are resolved.</p>
            </div>
          ) : (
            filtered.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={handleToggle}
                toggling={togglingId === task.id}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Priority Breakdown Card ── */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
            Completion Progress by Priority
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(['HIGH', 'MEDIUM', 'LOW'] as const).map(priority => {
            const total = tasks.filter(t => t.priority === priority).length
            const resolved = tasks.filter(t => t.priority === priority && t.resolved).length
            const pct = total > 0 ? Math.round((resolved / total) * 100) : 0
            const pc = priorityConfig(priority)
            return (
              <div key={priority} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={`flex items-center gap-1 ${pc.text}`}>
                    {pc.icon}{priority}
                  </span>
                  <span className="text-slate-500">{resolved}/{total} resolved ({pct}%)</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${pc.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── Toast notification ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl transition-all animate-in fade-in slide-in-from-bottom-4 ${
          toast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </main>
  )
}
