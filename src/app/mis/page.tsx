'use client'

import { useState, useCallback, useRef } from 'react'
import { Navbar } from '@/components/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRole } from '@/context/RoleContext'
import { formatINR, formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  FileBarChart2,
  Filter,
  Play,
  Download,
  Printer,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Building2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Table2,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ReportType {
  id: string
  label: string
  description: string
  filters: string[]
}

const REPORT_TYPES: ReportType[] = [
  {
    id: 'national_acquisition',
    label: 'National Acquisition Progress',
    description: 'Overview of land acquisition progress across all projects',
    filters: ['state', 'status', 'dateFrom', 'dateTo'],
  },
  {
    id: 'state_wise',
    label: 'State-wise Progress',
    description: 'Aggregated acquisition progress grouped by state',
    filters: ['state', 'status'],
  },
  {
    id: 'project_progress',
    label: 'Project Progress Report',
    description: 'Detailed land, compensation, and R&R status per project',
    filters: ['state', 'district', 'projectId', 'status'],
  },
  {
    id: 'compensation_status',
    label: 'Compensation Status',
    description: 'Compensation assessment and disbursement breakdown',
    filters: ['state', 'district', 'projectId'],
  },
  {
    id: 'possession_status',
    label: 'Possession & Acquisition Status',
    description: 'Parcel-level acquisition and possession tracking',
    filters: ['state', 'district', 'projectId'],
  },
  {
    id: 'rr_status',
    label: 'R&R (Rehabilitation & Resettlement)',
    description: 'Family rehabilitation and resettlement progress',
    filters: ['state', 'district', 'projectId'],
  },
  {
    id: 'delayed_projects',
    label: 'Delayed / At-Risk Projects',
    description: 'Projects past target date or with HIGH risk score',
    filters: ['state', 'status'],
  },
]

const STATES = [
  'All States',
  'Karnataka', 'Maharashtra', 'Delhi', 'Kerala',
  'Rajasthan', 'Gujarat', 'Tamil Nadu', 'Uttar Pradesh',
]

const PROJECT_STATUSES = ['All Statuses', 'ACTIVE', 'PLANNING', 'ON_HOLD', 'COMPLETED', 'CANCELLED']

// ─────────────────────────────────────────────────────────────────────────────
// CSV Export
// ─────────────────────────────────────────────────────────────────────────────

function exportCSV(rows: Record<string, unknown>[], reportLabel: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csvLines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h]
        const str = val === null || val === undefined ? '' : String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    ),
  ]
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bhoomisetu_${reportLabel.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// Column formatters per report type
// ─────────────────────────────────────────────────────────────────────────────

function formatCell(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    if (key.includes('Amount') || key.includes('Assessed') || key.includes('Paid') || key.includes('Pending')) {
      return formatINR(value as number)
    }
    if (key.includes('Pct') || key.includes('pct')) return `${value}%`
    if (key.includes('Acres') || key.includes('Area')) return `${formatNumber(value as number)} Ac`
    return formatNumber(value as number)
  }
  return String(value)
}

function columnLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace('Pct', '%')
    .replace('Rr', 'R&R')
    .trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk/Status badge
// ─────────────────────────────────────────────────────────────────────────────

function CellBadge({ value }: { value: string }) {
  const v = String(value).toUpperCase()
  if (v === 'HIGH' || v === 'DELAYED' || v === 'CANCELLED') {
    return <Badge variant="destructive" className="text-[10px] whitespace-nowrap">{value}</Badge>
  }
  if (v === 'MEDIUM' || v === 'AT RISK' || v === 'ON_HOLD' || v === 'PLANNING') {
    return <Badge variant="warning" className="text-[10px] whitespace-nowrap">{value}</Badge>
  }
  if (v === 'LOW' || v === 'ON_TRACK' || v === 'ACTIVE' || v === 'COMPLETED') {
    return <Badge variant="success" className="text-[10px] whitespace-nowrap">{value}</Badge>
  }
  return <Badge variant="secondary" className="text-[10px] whitespace-nowrap">{value}</Badge>
}

function shouldUseBadge(key: string): boolean {
  return ['riskLevel', 'status', 'timelineStatus', 'overdueStatus'].includes(key)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function MISReportsPage() {
  const { activeRole } = useRole()

  // Filters
  const [selectedReport, setSelectedReport] = useState<string>('national_acquisition')
  const [stateFilter, setStateFilter] = useState('All States')
  const [districtFilter, setDistrictFilter] = useState('')
  const [projectIdFilter, setProjectIdFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Report state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [generatedReport, setGeneratedReport] = useState<ReportType | null>(null)
  const [showFilters, setShowFilters] = useState(true)

  const printRef = useRef<HTMLDivElement>(null)

  const currentReportType = REPORT_TYPES.find(r => r.id === selectedReport)!
  const activeFilters = currentReportType?.filters ?? []

  // ── Generate report ────────────────────────────────────────────────────────

  const generateReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    setRows(null)

    const params = new URLSearchParams({ reportType: selectedReport })
    if (stateFilter !== 'All States') params.set('state', stateFilter)
    if (districtFilter.trim()) params.set('district', districtFilter.trim())
    if (projectIdFilter.trim()) params.set('projectId', projectIdFilter.trim())
    if (statusFilter !== 'All Statuses') params.set('status', statusFilter)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    try {
      const res = await fetch(`/api/mis?${params.toString()}`, {
        headers: { 'x-demo-role': activeRole },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Report generation failed')
        return
      }
      setRows(data.rows)
      setGeneratedAt(new Date().toISOString())
      setGeneratedReport(currentReportType)
      setShowFilters(false)
    } catch {
      setError('Network error. Please retry.')
    } finally {
      setLoading(false)
    }
  }, [selectedReport, stateFilter, districtFilter, projectIdFilter, statusFilter, dateFrom, dateTo, activeRole, currentReportType])

  // ── Role access ────────────────────────────────────────────────────────────

  const canAccess = ['CENTRAL', 'STATE', 'DISTRICT', 'PROJECT_OFFICER'].includes(activeRole)
  if (!canAccess) {
    return (
      <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Access Restricted</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            MIS Reports are not available for the <strong>{activeRole}</strong> role.
            Switch to Central, State, District, or Project Officer role.
          </p>
        </main>
      </div>
    )
  }

  // ── Table headers ──────────────────────────────────────────────────────────

  const columnKeys = rows && rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
        {/* Page header */}
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-sm">
                <FileBarChart2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  MIS Reports
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Management Information System · Live Database · PS26016
                </p>
              </div>
            </div>
            <Badge variant="info" className="hidden sm:inline-flex text-[11px]">
              {activeRole.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* ── FILTER PANEL ──────────────────────────────────────────────────── */}
        <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <CardHeader className="pb-0">
            <button
              onClick={() => setShowFilters(v => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Filter className="h-4 w-4" />
                Report Configuration
              </CardTitle>
              {showFilters ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>
          </CardHeader>

          {showFilters && (
            <CardContent className="pt-4 space-y-4">
              {/* Report type selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">
                  Report Type
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {REPORT_TYPES.map(rt => (
                    <button
                      key={rt.id}
                      onClick={() => setSelectedReport(rt.id)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-all',
                        selectedReport === rt.id
                          ? 'border-blue-500 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'
                      )}
                    >
                      <div className={cn(
                        'text-xs font-semibold',
                        selectedReport === rt.id
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-slate-700 dark:text-slate-300'
                      )}>
                        {rt.label}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                        {rt.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic filters */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">
                  Filters
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeFilters.includes('state') && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">State</label>
                      <select
                        value={stateFilter}
                        onChange={e => setStateFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {STATES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  )}

                  {activeFilters.includes('district') && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">District</label>
                      <input
                        type="text"
                        value={districtFilter}
                        onChange={e => setDistrictFilter(e.target.value)}
                        placeholder="e.g. Belgaum"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      />
                    </div>
                  )}

                  {activeFilters.includes('status') && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Project Status</label>
                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  )}

                  {activeFilters.includes('dateFrom') && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Start Date From</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      />
                    </div>
                  )}

                  {activeFilters.includes('dateTo') && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Start Date To</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={generateReport}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {loading ? 'Generating…' : 'Generate Report'}
              </button>
            </CardContent>
          )}
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── REPORT RESULTS ─────────────────────────────────────────────────── */}
        {rows !== null && (
          <div id="mis-report-output" ref={printRef} className="space-y-4">
            {/* Result header + exports */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-slate-500" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {generatedReport?.label}
                  </h2>
                  <Badge variant="info" className="text-[10px]">
                    {rows.length} rows
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Generated {generatedAt ? new Date(generatedAt).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  }) : ''}{' '}
                  · Role: {activeRole}
                  {stateFilter !== 'All States' && ` · State: ${stateFilter}`}
                  {statusFilter !== 'All Statuses' && ` · Status: ${statusFilter}`}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowFilters(v => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                >
                  <RefreshCw className="h-3 w-3" />
                  Modify Filters
                </button>
                <button
                  onClick={() => exportCSV(rows, generatedReport?.label ?? 'report')}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / PDF
                </button>
              </div>
            </div>

            {rows.length === 0 ? (
              <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <CardContent className="py-12 text-center">
                  <Building2 className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm font-medium text-slate-500">
                    No data matches the selected filters
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try widening your filter criteria
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/80">
                      {columnKeys.map(key => (
                        <th
                          key={key}
                          className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap"
                        >
                          {columnLabel(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        {columnKeys.map(key => {
                          const value = row[key]
                          const isBadge = shouldUseBadge(key)

                          return (
                            <td
                              key={key}
                              className={cn(
                                'px-4 py-2.5 text-slate-700 dark:text-slate-300',
                                key === 'project' && 'font-semibold text-slate-900 dark:text-white min-w-[180px]',
                                (key.includes('Pct') || key.includes('pct')) && 'font-bold',
                              )}
                            >
                              {isBadge ? (
                                <CellBadge value={String(value ?? '')} />
                              ) : (
                                <span className={cn(
                                  typeof value === 'number' && key.includes('Pct') && (value as number) < 30
                                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                                    : typeof value === 'number' && key.includes('Pct') && (value as number) >= 70
                                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                    : ''
                                )}>
                                  {formatCell(key, value)}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary row for numeric columns */}
                {rows.length > 1 && (
                  <div className="border-t border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/60 px-4 py-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="font-semibold">Summary:</span>
                      {columnKeys
                        .filter(k => typeof rows[0][k] === 'number' && !k.includes('Pct') && !k.includes('Score'))
                        .slice(0, 4)
                        .map(k => {
                          const sum = rows.reduce((s, r) => s + ((r[k] as number) ?? 0), 0)
                          return (
                            <span key={k}>
                              {columnLabel(k)}: <strong>{formatCell(k, sum)}</strong>
                            </span>
                          )
                        })
                      }
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verification note */}
            <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-[10px] text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Data sourced from live Neon PostgreSQL database · Filtered by applied criteria ·
                Prototype PS26016 · Generated {generatedAt ? new Date(generatedAt).toLocaleString('en-IN') : ''}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #mis-report-output { display: block !important; }
          nav, header { display: none !important; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  )
}
