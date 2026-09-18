'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Scale,
  Landmark,
  Users,
  Clock,
  MapPin,
  TrendingDown,
  ExternalLink,
  FileCheck2,
  Info,
  CheckCircle2,
  Zap,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RiskFactor, RiskLevel } from '@/lib/services/risk-engine'
import type { Recommendation, RecommendationPriority } from '@/lib/services/recommendations'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectInfo {
  id: string
  name: string
  type: string
  state: string
  district: string
  status: string
  targetDate: string
}

interface RiskResultClient {
  overallScore: number
  riskLevel: RiskLevel
  dominantFactor: string
  computedAt: string
  factors: RiskFactor[]
}

interface Props {
  project: ProjectInfo
  riskResult: RiskResultClient
  recommendations: Recommendation[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)} Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)} L`
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk level colour helpers
// ─────────────────────────────────────────────────────────────────────────────

function riskColors(level: RiskLevel) {
  switch (level) {
    case 'LOW':
      return {
        gauge: '#22c55e',       // green-500
        gaugeBg: '#dcfce7',     // green-100
        text: 'text-emerald-600 dark:text-emerald-400',
        badge: 'success' as const,
        icon: <ShieldCheck className="h-5 w-5" />,
        label: 'Low Risk — On Track',
        gradientFrom: 'from-emerald-500',
        gradientTo: 'to-green-400',
        border: 'border-emerald-200 dark:border-emerald-900/50',
        bg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
      }
    case 'MEDIUM':
      return {
        gauge: '#f59e0b',       // amber-500
        gaugeBg: '#fef3c7',     // amber-100
        text: 'text-amber-600 dark:text-amber-400',
        badge: 'warning' as const,
        icon: <AlertTriangle className="h-5 w-5" />,
        label: 'Medium Risk — Attention Required',
        gradientFrom: 'from-amber-500',
        gradientTo: 'to-orange-400',
        border: 'border-amber-200 dark:border-amber-900/50',
        bg: 'bg-amber-50/40 dark:bg-amber-950/20',
      }
    case 'HIGH':
    default:
      return {
        gauge: '#ef4444',       // red-500
        gaugeBg: '#fee2e2',     // red-100
        text: 'text-red-600 dark:text-red-400',
        badge: 'destructive' as const,
        icon: <ShieldAlert className="h-5 w-5" />,
        label: 'High Risk — Immediate Action',
        gradientFrom: 'from-red-500',
        gradientTo: 'to-rose-400',
        border: 'border-red-200 dark:border-red-900/50',
        bg: 'bg-red-50/40 dark:bg-red-950/20',
      }
  }
}

function factorColors(score: number) {
  if (score <= 30) return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' }
  if (score <= 60) return { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' }
  return { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400' }
}

function recommendationColors(priority: RecommendationPriority) {
  switch (priority) {
    case 'CRITICAL':
      return {
        border: 'border-l-red-500',
        badge: 'destructive' as const,
        icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
        bg: 'bg-red-50/60 dark:bg-red-950/20',
      }
    case 'HIGH':
      return {
        border: 'border-l-amber-500',
        badge: 'warning' as const,
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        bg: 'bg-amber-50/60 dark:bg-amber-950/20',
      }
    case 'MEDIUM':
    default:
      return {
        border: 'border-l-blue-500',
        badge: 'info' as const,
        icon: <Info className="h-4 w-4 text-blue-500" />,
        bg: 'bg-blue-50/60 dark:bg-blue-950/20',
      }
  }
}

function factorIcon(factorId: string) {
  switch (factorId) {
    case 'legal':       return <Scale className="h-4 w-4" />
    case 'compensation': return <Landmark className="h-4 w-4" />
    case 'delay':       return <Clock className="h-4 w-4" />
    case 'rr':          return <Users className="h-4 w-4" />
    case 'acquisition': return <MapPin className="h-4 w-4" />
    default:            return <TrendingDown className="h-4 w-4" />
  }
}

function formatRawValue(factorId: string, rawValue: number, rawUnit: string): string {
  if (factorId === 'compensation') return `${formatINR(rawValue)} pending`
  if (['legal', 'rr', 'acquisition'].includes(factorId)) return `${formatNumber(rawValue)} ${rawUnit}`
  return `${rawValue} ${rawUnit}`
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Gauge Component
// ─────────────────────────────────────────────────────────────────────────────

function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const colors = riskColors(level)

  // Semi-circle gauge: 180° arc from left to right
  // SVG viewBox: 200×110, center: (100, 100), radius: 80
  const cx = 100, cy = 100, r = 80
  const strokeWidth = 14
  const circumference = Math.PI * r  // half-circle arc length
  const filled = (score / 100) * circumference

  // Path for the arc (left = 180deg, right = 0deg, going clockwise)
  // Start point: (cx - r, cy), end: (cx + r, cy)
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  // Tick marks at 0, 30, 60, 100 (for the band boundaries)
  function anglePoint(pct: number, radiusOffset: number) {
    const angle = Math.PI * (1 - pct) // 0%=180deg, 100%=0deg
    return {
      x: cx + (r + radiusOffset) * Math.cos(angle),
      y: cy - (r + radiusOffset) * Math.sin(angle),
    }
  }

  const ticks = [
    { pct: 0,    label: '0' },
    { pct: 0.30, label: '30' },
    { pct: 0.60, label: '60' },
    { pct: 1.0,  label: '100' },
  ]

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 115" className="w-64 h-auto" aria-label={`Risk gauge showing ${score} out of 100`}>
        {/* Background track */}
        <path
          d={arcPath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="dark:[stroke:#334155]"
        />

        {/* LOW zone (0–30) — green */}
        <path
          d={arcPath}
          fill="none"
          stroke="#22c55e"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={`${(0.30) * circumference} ${circumference}`}
          strokeDashoffset={0}
          opacity={0.22}
        />
        {/* MEDIUM zone (30–60) — amber */}
        <path
          d={arcPath}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={`${(0.30) * circumference} ${circumference}`}
          strokeDashoffset={-(0.30) * circumference}
          opacity={0.22}
        />
        {/* HIGH zone (60–100) — red */}
        <path
          d={arcPath}
          fill="none"
          stroke="#ef4444"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeDasharray={`${(0.40) * circumference} ${circumference}`}
          strokeDashoffset={-(0.60) * circumference}
          opacity={0.22}
        />

        {/* Filled arc — score progress */}
        <path
          d={arcPath}
          fill="none"
          stroke={colors.gauge}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          strokeDashoffset={0}
          style={{ filter: `drop-shadow(0 0 6px ${colors.gauge}60)` }}
        />

        {/* Tick marks */}
        {ticks.map(tick => {
          const inner = anglePoint(tick.pct, -strokeWidth / 2 - 2)
          const outer = anglePoint(tick.pct, strokeWidth / 2 + 2)
          const labelPt = anglePoint(tick.pct, strokeWidth / 2 + 14)
          return (
            <g key={tick.pct}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke="#94a3b8" strokeWidth={1.5} />
              <text x={labelPt.x} y={labelPt.y}
                fontSize={7} fill="#94a3b8"
                textAnchor="middle" dominantBaseline="middle">
                {tick.label}
              </text>
            </g>
          )
        })}

        {/* Center score text */}
        <text x={cx} y={cy - 12} fontSize={30} fontWeight="800"
          fill={colors.gauge} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: 'inherit' }}>
          {score}
        </text>
        <text x={cx} y={cy + 8} fontSize={8} fill="#94a3b8"
          textAnchor="middle" fontWeight="600">
          OUT OF 100
        </text>
      </svg>

      {/* Level label below gauge */}
      <div className={`flex items-center gap-1.5 mt-1 font-bold text-sm ${colors.text}`}>
        {colors.icon}
        <span>{colors.label}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor Bar Row
// ─────────────────────────────────────────────────────────────────────────────

function FactorRow({ factor, isDominant }: { factor: RiskFactor; isDominant: boolean }) {
  const fc = factorColors(factor.normalizedScore)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`rounded-lg border p-4 transition-all duration-200 ${
        isDominant
          ? 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/15'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60'
      } ${hovered ? 'shadow-md' : 'shadow-sm'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: name + raw value */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`flex-shrink-0 rounded-md p-1.5 ${
            isDominant
              ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {factorIcon(factor.id)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {factor.name}
              </span>
              {isDominant && (
                <Badge variant="destructive" className="text-[10px] py-0 px-1.5 flex-shrink-0">
                  Top Risk
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {formatRawValue(factor.id, factor.rawValue, factor.rawUnit)}
            </span>
          </div>
        </div>

        {/* Right: weight + weighted score */}
        <div className="flex-shrink-0 text-right">
          <div className={`text-base font-black ${fc.text}`}>
            {factor.weightedScore.toFixed(1)}
          </div>
          <div className="text-[11px] text-slate-400">
            of {factor.maxWeightedScore.toFixed(0)} max
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span>Normalized Score</span>
          <span className={fc.text}>{factor.normalizedScore}/100</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-700 ${fc.bar}`}
            style={{ width: `${factor.normalizedScore}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Weight: {(factor.weight * 100).toFixed(0)}%</span>
          <span>{factor.description}</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Card
// ─────────────────────────────────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [toastVisible, setToastVisible] = useState(false)
  const rc = recommendationColors(rec.priority)

  function handleAction() {
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2500)
  }

  return (
    <div className={`relative rounded-lg border border-l-4 ${rc.border} ${rc.bg} p-4 shadow-sm transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="flex-shrink-0 mt-0.5">{rc.icon}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {rec.title}
              </span>
              <Badge variant={rc.badge} className="text-[10px] py-0 px-1.5">
                {rec.priority}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {rec.detail}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          Trigger score: {rec.triggerScore.toFixed(1)} pts
        </span>
        <button
          onClick={handleAction}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-bold text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors"
        >
          <Zap className="h-3 w-3" />
          {rec.actionLabel}
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Toast */}
      {toastVisible && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900 shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-600" />
          Action logged — Workflow module coming soon
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Client Component
// ─────────────────────────────────────────────────────────────────────────────

export default function RiskDashboardClient({ project, riskResult, recommendations }: Props) {
  const colors = riskColors(riskResult.riskLevel)

  // Weights must sum to 1.0 — display as formula verification
  const weightSum = riskResult.factors.reduce((sum, f) => sum + f.weight, 0)

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Project Dashboard
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${project.id}/map`}
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            GIS Map
          </Link>
          <Link
            href={`/projects/${project.id}/documents`}
            className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 transition-colors"
          >
            <FileCheck2 className="h-3 w-3" />
            Documents
          </Link>
        </div>
      </div>

      {/* ── Hero Header ── */}
      <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-6 sm:p-8`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">

          {/* Left: project info + overall score description */}
          <div className="space-y-4 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider">
                {project.type}
              </Badge>
              <Badge variant={colors.badge} className="gap-1 font-semibold">
                {colors.icon}
                {riskResult.riskLevel} RISK
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                AI Risk Engine v1
              </Badge>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Risk Assessment
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {project.name}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {project.district}, {project.state} · Status: {project.status}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Dominant Risk Factor
              </div>
              <div className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-bold ${colors.border} ${colors.text}`}>
                {factorIcon(riskResult.factors[0]?.id ?? '')}
                {riskResult.dominantFactor}
                <span className="text-xs font-normal text-slate-500 ml-1">
                  ({riskResult.factors[0]?.weightedScore.toFixed(1)} pts / {riskResult.factors[0]?.maxWeightedScore.toFixed(0)} max)
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Computed {formatDate(riskResult.computedAt)} from live Prisma queries.
              Score = Σ(normalizedFactor × weight). No LLM involved.
            </div>
          </div>

          {/* Right: SVG Gauge */}
          <div className="flex flex-col items-center lg:items-end">
            <RiskGauge score={riskResult.overallScore} level={riskResult.riskLevel} />
          </div>
        </div>
      </div>

      {/* ── Two-column layout: factors + recommendations ── */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-5">

        {/* ── Factor Breakdown (3/5 width) ── */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                    5-Factor Risk Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Deterministic scores from live DB queries. Weights sum to {(weightSum * 100).toFixed(0)}%.
                    Overall = {riskResult.factors.map(f => `${(f.weight * 100).toFixed(0)}%×${f.normalizedScore}`).join(' + ')} = {riskResult.overallScore}/100
                  </CardDescription>
                </div>
                <Badge variant="info" className="text-[10px] flex-shrink-0">
                  Real-Time
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {riskResult.factors.map((factor) => (
                <FactorRow
                  key={factor.id}
                  factor={factor}
                  isDominant={factor.name === riskResult.dominantFactor}
                />
              ))}

              {/* Weight legend */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3">
                {riskResult.factors
                  .slice()
                  .sort((a, b) => b.weight - a.weight)
                  .map(f => (
                    <div key={f.id} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      {factorIcon(f.id)}
                      <span>{f.name}: <strong className="text-slate-700 dark:text-slate-300">{(f.weight * 100).toFixed(0)}%</strong></span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Score Band Reference */}
          <Card className="border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                Risk Band Reference
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className={`rounded-lg p-3 border ${riskResult.riskLevel === 'LOW' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-emerald-200/50 bg-emerald-50/30 dark:bg-emerald-950/10'}`}>
                  <div className="flex items-center justify-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> LOW
                  </div>
                  <div className="text-[11px] text-slate-500">Score 0 – 30</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-500 font-medium">On Track</div>
                  {riskResult.riskLevel === 'LOW' && <div className="mt-1 text-[10px] font-bold text-emerald-600">← Current</div>}
                </div>
                <div className={`rounded-lg p-3 border ${riskResult.riskLevel === 'MEDIUM' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : 'border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10'}`}>
                  <div className="flex items-center justify-center gap-1 font-bold text-amber-700 dark:text-amber-400 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> MEDIUM
                  </div>
                  <div className="text-[11px] text-slate-500">Score 31 – 60</div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-500 font-medium">At Risk</div>
                  {riskResult.riskLevel === 'MEDIUM' && <div className="mt-1 text-[10px] font-bold text-amber-600">← Current</div>}
                </div>
                <div className={`rounded-lg p-3 border ${riskResult.riskLevel === 'HIGH' ? 'border-red-400 bg-red-50 dark:bg-red-950/30' : 'border-red-200/50 bg-red-50/30 dark:bg-red-950/10'}`}>
                  <div className="flex items-center justify-center gap-1 font-bold text-red-700 dark:text-red-400 mb-1">
                    <ShieldAlert className="h-3.5 w-3.5" /> HIGH
                  </div>
                  <div className="text-[11px] text-slate-500">Score 61 – 100</div>
                  <div className="text-[11px] text-red-600 dark:text-red-500 font-medium">Immediate Action</div>
                  {riskResult.riskLevel === 'HIGH' && <div className="mt-1 text-[10px] font-bold text-red-600">← Current</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Recommendations (2/5 width) ── */}
        <div className="xl:col-span-2 space-y-4">
          <Card className="border-slate-200 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                    AI Recommendations
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {recommendations.length} actions · sorted by risk priority
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                  Deterministic
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.id} rec={rec} />
              ))}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                  <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  Recommendations are generated by template rules from the computed risk data.
                  Action buttons will trigger the Workflow module (Step 7 — coming soon).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
