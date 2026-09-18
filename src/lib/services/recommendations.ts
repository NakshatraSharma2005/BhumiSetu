/**
 * BhūmiSetu — Recommendation Engine
 *
 * Pure function: given a computed RiskResult, returns 2–4 prioritised
 * action recommendations based on which factors breach the threshold.
 *
 * IMPORTANT: This function uses ONLY the structured RiskResult data that
 * was computed deterministically by risk-engine.ts. It never calls an LLM
 * and never generates or guesses any numbers itself.
 *
 * Threshold: factors with weightedScore > 8 trigger a recommendation.
 * This guarantees ≥2 recommendations for all realistic seeded projects.
 */

import type { RiskResult, RiskFactor, RawProjectStats } from './risk-engine'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM'

export interface Recommendation {
  id: string
  factorId: string
  priority: RecommendationPriority
  title: string
  detail: string
  actionLabel: string
  /** The weightedScore of the factor that triggered this recommendation */
  triggerScore: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const THRESHOLD = 8 // weightedScore above this triggers a recommendation

function priorityFromScore(weightedScore: number, maxWeightedScore: number): RecommendationPriority {
  const pct = weightedScore / maxWeightedScore
  if (pct >= 0.75) return 'CRITICAL'
  if (pct >= 0.45) return 'HIGH'
  return 'MEDIUM'
}

function formatINR(amount: number): string {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)} Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)} L`
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-factor recommendation builders
// ─────────────────────────────────────────────────────────────────────────────

function legalRecommendation(factor: RiskFactor, raw: RawProjectStats): Recommendation {
  const parcelPct = raw.totalParcels > 0
    ? ((raw.openLegalCases / raw.totalParcels) * 100).toFixed(1)
    : '0'
  return {
    id: 'rec-legal',
    factorId: 'legal',
    priority: priorityFromScore(factor.weightedScore, factor.maxWeightedScore),
    title: 'Expedite Legal Dispute Resolution',
    detail: `${raw.openLegalCases} open/under-investigation cases represent ${parcelPct}% of corridor parcels. ` +
      `Engage Special Land Acquisition Courts and Revenue Department legal cell to fast-track hearings. ` +
      `Unresolved disputes are the leading contributor to project delay risk.`,
    actionLabel: 'Flag for Legal Escalation',
    triggerScore: factor.weightedScore,
  }
}

function compensationRecommendation(factor: RiskFactor, raw: RawProjectStats): Recommendation {
  const pendingAmount = raw.assessedCompensation - raw.paidCompensation
  const pendingPct = raw.assessedCompensation > 0
    ? ((pendingAmount / raw.assessedCompensation) * 100).toFixed(1)
    : '0'
  return {
    id: 'rec-compensation',
    factorId: 'compensation',
    priority: priorityFromScore(factor.weightedScore, factor.maxWeightedScore),
    title: 'Release Pending Compensation',
    detail: `${formatINR(pendingAmount)} (${pendingPct}% of assessed value) remains undisbursed. ` +
      `Delayed compensation is a primary driver of landowner grievances and legal escalations. ` +
      `Prioritise PARTIALLY_PAID parcels by highest pending amount to prevent litigation.`,
    actionLabel: 'Initiate Disbursement Review',
    triggerScore: factor.weightedScore,
  }
}

function delayRecommendation(factor: RiskFactor, raw: RawProjectStats): Recommendation {
  return {
    id: 'rec-delay',
    factorId: 'delay',
    priority: priorityFromScore(factor.weightedScore, factor.maxWeightedScore),
    title: 'Escalate Overdue HIGH-Priority Tasks',
    detail: `The oldest unresolved HIGH-priority task has been pending for ${raw.worstTaskDaysPending} days — ` +
      `${((raw.worstTaskDaysPending / 60) * 100).toFixed(0)}% of the 60-day critical threshold. ` +
      `Escalate to District Collector for administrative force-closure. ` +
      `Review all unresolved HIGH tasks weekly until cleared.`,
    actionLabel: 'Schedule District Review',
    triggerScore: factor.weightedScore,
  }
}

function rrRecommendation(factor: RiskFactor, raw: RawProjectStats): Recommendation {
  const pendingFamilies = raw.totalRRRecords - raw.completedRRRecords
  const completedPct = raw.totalRRRecords > 0
    ? ((raw.completedRRRecords / raw.totalRRRecords) * 100).toFixed(1)
    : '0'
  return {
    id: 'rec-rr',
    factorId: 'rr',
    priority: priorityFromScore(factor.weightedScore, factor.maxWeightedScore),
    title: 'Accelerate R&R for Pending Families',
    detail: `${pendingFamilies} affected families (${completedPct}% completion rate) have incomplete ` +
      `Resettlement & Rehabilitation under LARR Act 2013. ` +
      `Non-compliance with Section 31–38 mandates can trigger High Court stay orders. ` +
      `Assign dedicated R&R officers per village cluster to clear DOCS_PENDING backlog.`,
    actionLabel: 'Assign R&R Task Force',
    triggerScore: factor.weightedScore,
  }
}

function acquisitionRecommendation(factor: RiskFactor, raw: RawProjectStats): Recommendation {
  const remaining = raw.totalParcels - raw.acquiredParcels
  const acquiredPct = raw.totalParcels > 0
    ? ((raw.acquiredParcels / raw.totalParcels) * 100).toFixed(1)
    : '0'
  return {
    id: 'rec-acquisition',
    factorId: 'acquisition',
    priority: priorityFromScore(factor.weightedScore, factor.maxWeightedScore),
    title: 'Accelerate Parcel Acquisition Pipeline',
    detail: `${remaining} of ${raw.totalParcels} parcels (${acquiredPct}% acquired so far) remain ` +
      `un-acquired. Accelerate Section 19 notifications and resolve objections under Section 25 ` +
      `to move parcels from NOTIFICATION/OBJECTION stage through to POSSESSION. ` +
      `Focus on clusters near project's critical-path infrastructure segments.`,
    actionLabel: 'Review Acquisition Pipeline',
    triggerScore: factor.weightedScore,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main recommendation function
// ─────────────────────────────────────────────────────────────────────────────

const BUILDERS: Record<string, (factor: RiskFactor, raw: RawProjectStats) => Recommendation> = {
  legal: legalRecommendation,
  compensation: compensationRecommendation,
  delay: delayRecommendation,
  rr: rrRecommendation,
  acquisition: acquisitionRecommendation,
}

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
}

export function getRecommendations(result: RiskResult): Recommendation[] {
  const { factors, _raw } = result

  // Collect recommendations for factors above threshold
  const recs: Recommendation[] = []

  for (const factor of factors) {
    if (factor.weightedScore > THRESHOLD) {
      const builder = BUILDERS[factor.id]
      if (builder) {
        recs.push(builder(factor, _raw))
      }
    }
  }

  // If fewer than 2, force-add from top factors (regardless of threshold)
  if (recs.length < 2) {
    const covered = new Set(recs.map(r => r.factorId))
    for (const factor of factors) {
      if (recs.length >= 2) break
      if (!covered.has(factor.id)) {
        const builder = BUILDERS[factor.id]
        if (builder) {
          recs.push(builder(factor, _raw))
          covered.add(factor.id)
        }
      }
    }
  }

  // Cap at 4 recommendations, sort by priority then triggerScore
  return recs
    .sort((a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      b.triggerScore - a.triggerScore
    )
    .slice(0, 4)
}
