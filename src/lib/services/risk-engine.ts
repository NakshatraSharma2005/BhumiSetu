/**
 * BhūmiSetu — Deterministic Risk Engine
 *
 * Computes a structured 5-factor risk score from LIVE database queries.
 * No LLM, no random numbers, no cached fields — every number is derived
 * directly from Prisma aggregations at call time.
 *
 * Score bands: 0–30 LOW · 31–60 MEDIUM · 61–100 HIGH
 */

import { prisma } from '@/lib/prisma'
import { LegalCaseStatus, TaskPriority } from '@/generated/prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RiskFactor {
  id: string
  name: string
  description: string
  rawValue: number        // the raw DB metric (e.g. 143 open cases)
  rawUnit: string         // human-readable unit (e.g. "open cases")
  normalizedScore: number // 0–100, this factor's standalone contribution
  weight: number          // e.g. 0.25
  weightedScore: number   // normalizedScore * weight  (0–25/20/20/15/20 respectively)
  maxWeightedScore: number // weight * 100 — the ceiling for this factor
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface RiskResult {
  overallScore: number       // 0–100, weighted sum of all factors
  riskLevel: RiskLevel
  factors: RiskFactor[]      // sorted: highest weightedScore first
  dominantFactor: string     // name of the factor contributing most
  computedAt: string         // ISO timestamp
  /** Raw data snapshot passed to the recommendation engine */
  _raw: RawProjectStats
}

export interface RawProjectStats {
  projectId: string
  totalParcels: number
  acquiredParcels: number
  openLegalCases: number
  assessedCompensation: number
  paidCompensation: number
  worstTaskDaysPending: number
  totalRRRecords: number
  completedRRRecords: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Clamp a value to [0, 100] and round to 1 decimal */
function clamp100(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10))
}

/** Build a RiskFactor object, computing weightedScore internally */
function makeFactor(
  id: string,
  name: string,
  description: string,
  rawValue: number,
  rawUnit: string,
  normalizedScore: number,
  weight: number
): RiskFactor {
  const clamped = clamp100(normalizedScore)
  return {
    id,
    name,
    description,
    rawValue,
    rawUnit,
    normalizedScore: clamped,
    weight,
    weightedScore: Math.round(clamped * weight * 10) / 10,
    maxWeightedScore: weight * 100,
  }
}

function scoreToLevel(score: number): RiskLevel {
  if (score <= 30) return 'LOW'
  if (score <= 60) return 'MEDIUM'
  return 'HIGH'
}

// ─────────────────────────────────────────────────────────────────────────────
// Main computation function
// ─────────────────────────────────────────────────────────────────────────────

export async function computeProjectRisk(projectId: string): Promise<RiskResult> {
  // ── Run all 5 DB queries in parallel ──────────────────────────────────────

  const [
    parcelCounts,
    compensationAgg,
    openLegalCount,
    worstHighTask,
    rrCounts,
  ] = await Promise.all([
    // 1. Parcel acquisition status breakdown
    prisma.landParcel.groupBy({
      by: ['acquisitionStatus'],
      where: { projectId },
      _count: { _all: true },
    }),

    // 2. Compensation paid vs assessed
    prisma.compensation.aggregate({
      where: { parcel: { projectId } },
      _sum: { assessedAmount: true, paidAmount: true },
    }),

    // 3. Open/under-investigation legal cases
    prisma.legalCase.count({
      where: {
        parcel: { projectId },
        status: {
          in: [LegalCaseStatus.OPEN, LegalCaseStatus.UNDER_INVESTIGATION],
        },
      },
    }),

    // 4. Worst unresolved HIGH-priority task's daysPending
    prisma.task.findFirst({
      where: {
        projectId,
        priority: TaskPriority.HIGH,
        resolved: false,
      },
      orderBy: { daysPending: 'desc' },
      select: { daysPending: true },
    }),

    // 5. R&R record status breakdown
    prisma.rRRecord.groupBy({
      by: ['status'],
      where: { parcel: { projectId } },
      _count: { _all: true },
    }),
  ])

  // ── Derive raw metrics ─────────────────────────────────────────────────────

  // Parcels
  const totalParcels = parcelCounts.reduce((sum, r) => sum + r._count._all, 0)
  const acquiredParcels = parcelCounts
    .filter(r => r.acquisitionStatus === 'ACQUIRED' || r.acquisitionStatus === 'POSSESSION')
    .reduce((sum, r) => sum + r._count._all, 0)

  // Compensation
  const assessed = compensationAgg._sum.assessedAmount ?? 0
  const paid = compensationAgg._sum.paidAmount ?? 0

  // Approval delay
  const worstDaysPending = worstHighTask?.daysPending ?? 0

  // R&R
  const totalRR = rrCounts.reduce((sum, r) => sum + r._count._all, 0)
  const completedRR = rrCounts
    .filter(r => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + r._count._all, 0)

  // ── Factor 1: Legal Risk (weight 0.25) ───────────────────────────────────
  // normalizedScore = (openCases / totalParcels) / 0.30 × 100
  // 30% open-case ratio → 100% risk (cap)
  const legalRatio = totalParcels > 0 ? openLegalCount / totalParcels : 0
  const legalNorm = clamp100((legalRatio / 0.30) * 100)
  const legalFactor = makeFactor(
    'legal',
    'Legal Disputes',
    'Pending & under-investigation legal cases as a proportion of total parcels',
    openLegalCount,
    'open cases',
    legalNorm,
    0.25
  )

  // ── Factor 2: Compensation Risk (weight 0.20) ─────────────────────────────
  // normalizedScore = (1 − paid/assessed) × 100
  const compRatio = assessed > 0 ? paid / assessed : 0
  const compNorm = clamp100((1 - compRatio) * 100)
  const compFactor = makeFactor(
    'compensation',
    'Compensation Pending',
    'Proportion of assessed compensation not yet disbursed to landowners',
    Math.round(assessed - paid),
    '₹ pending',
    compNorm,
    0.20
  )

  // ── Factor 3: Approval Delay Risk (weight 0.20) ───────────────────────────
  // normalizedScore = min(worstDaysPending / 60, 1) × 100
  // 60 days → 100% risk
  const delayNorm = clamp100((worstDaysPending / 60) * 100)
  const delayFactor = makeFactor(
    'delay',
    'Approval Delay',
    'Days the oldest unresolved HIGH-priority task has been pending (60-day threshold)',
    worstDaysPending,
    'days pending',
    delayNorm,
    0.20
  )

  // ── Factor 4: R&R Risk (weight 0.15) ──────────────────────────────────────
  // normalizedScore = (1 − completedRR/totalRR) × 100
  const rrRatio = totalRR > 0 ? completedRR / totalRR : 0
  const rrNorm = clamp100((1 - rrRatio) * 100)
  const rrFactor = makeFactor(
    'rr',
    'R&R Compliance',
    'Proportion of resettlement & rehabilitation records not yet completed (LARR Act)',
    totalRR - completedRR,
    'families pending',
    rrNorm,
    0.15
  )

  // ── Factor 5: Acquisition Progress Risk (weight 0.20) ────────────────────
  // normalizedScore = (1 − acquired/total) × 100
  const acqRatio = totalParcels > 0 ? acquiredParcels / totalParcels : 0
  const acqNorm = clamp100((1 - acqRatio) * 100)
  const acqFactor = makeFactor(
    'acquisition',
    'Acquisition Progress',
    'Proportion of parcels not yet acquired or in possession',
    totalParcels - acquiredParcels,
    'parcels remaining',
    acqNorm,
    0.20
  )

  // ── Aggregate ─────────────────────────────────────────────────────────────

  const factors: RiskFactor[] = [
    legalFactor,
    compFactor,
    delayFactor,
    rrFactor,
    acqFactor,
  ].sort((a, b) => b.weightedScore - a.weightedScore)

  const overallScore = clamp100(
    factors.reduce((sum, f) => sum + f.weightedScore, 0)
  )

  const dominantFactor = factors[0].name

  const raw: RawProjectStats = {
    projectId,
    totalParcels,
    acquiredParcels,
    openLegalCases: openLegalCount,
    assessedCompensation: assessed,
    paidCompensation: paid,
    worstTaskDaysPending: worstDaysPending,
    totalRRRecords: totalRR,
    completedRRRecords: completedRR,
  }

  return {
    overallScore,
    riskLevel: scoreToLevel(overallScore),
    factors,
    dominantFactor,
    computedAt: new Date().toISOString(),
    _raw: raw,
  }
}
