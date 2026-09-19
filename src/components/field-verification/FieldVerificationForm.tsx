'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Camera,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Upload,
  Send,
  Loader2,
  User,
  FileText,
  Building2,
  Info,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatINR } from '@/lib/utils'
import { useRole } from '@/context/RoleContext'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ParcelOwner {
  name: string
  contactInfo: Record<string, string>
}

interface ParcelCompensation {
  assessedAmount: number
  paidAmount: number
  status: string
}

interface TaskParcel {
  id: string
  parcelCode: string
  surveyNumber: string
  village: string
  district: string
  state: string
  areaAcres: number
  acquisitionStatus: string
  legalStatus: string
  rrStatus: string
  lat: number | null
  lng: number | null
  owner: ParcelOwner | null
  compensation: ParcelCompensation | null
}

interface TaskProject {
  id: string
  name: string
  type: string
  state: string
  district: string
}

interface ExistingVerification {
  id: string
  checklistParcelId: boolean
  checklistBoundary: boolean
  checklistArea: boolean
  checklistLandUse: boolean
  checklistOwnership: boolean
  checklistEncumbrance: boolean
  remarks: string
  gpsLat: number | null
  gpsLng: number | null
  gpsAccuracy: number | null
  photoRef: string | null
  verifierRole: string
  submittedAt: string
}

interface TaskData {
  id: string
  description: string
  priority: string
  responsibleRole: string
  daysPending: number
  dueDate: string | null
  resolved: boolean
  parcel: TaskParcel | null
  project: TaskProject | null
  existingVerification: ExistingVerification | null
}

interface ChecklistState {
  parcelId: boolean
  boundary: boolean
  area: boolean
  landUse: boolean
  ownership: boolean
  encumbrance: boolean
}

interface GPSState {
  lat: number | null
  lng: number | null
  accuracy: number | null
  source: 'none' | 'browser' | 'demo'
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatAcqStatus(s: string) {
  return s.replace(/_/g, ' ')
}

function acqStatusBadge(s: string) {
  if (s === 'ACQUIRED') return <Badge variant="success" className="text-[10px]">{formatAcqStatus(s)}</Badge>
  if (s === 'LEGAL_DISPUTE') return <Badge variant="destructive" className="text-[10px]">{formatAcqStatus(s)}</Badge>
  return <Badge variant="warning" className="text-[10px]">{formatAcqStatus(s)}</Badge>
}

function ChecklistItem({
  label,
  checked,
  onToggle,
  disabled,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
        checked
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
      aria-checked={checked}
      role="checkbox"
    >
      {checked ? (
        <CheckSquare className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Square className="h-5 w-5 shrink-0 text-slate-400" />
      )}
      <span className={cn(
        'text-sm font-medium',
        checked ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300'
      )}>
        {label}
      </span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Form
// ─────────────────────────────────────────────────────────────────────────────

export default function FieldVerificationForm({ task }: { task: TaskData }) {
  const { activeRole } = useRole()
  const existing = task.existingVerification

  // Initialise from existing verification if present
  const [checklist, setChecklist] = useState<ChecklistState>({
    parcelId: existing?.checklistParcelId ?? false,
    boundary: existing?.checklistBoundary ?? false,
    area: existing?.checklistArea ?? false,
    landUse: existing?.checklistLandUse ?? false,
    ownership: existing?.checklistOwnership ?? false,
    encumbrance: existing?.checklistEncumbrance ?? false,
  })

  const [gps, setGps] = useState<GPSState>({
    lat: existing?.gpsLat ?? null,
    lng: existing?.gpsLng ?? null,
    accuracy: existing?.gpsAccuracy ?? null,
    source: existing?.gpsLat ? 'browser' : 'none',
  })
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const [remarks, setRemarks] = useState(existing?.remarks ?? '')
  const [photoRef, setPhotoRef] = useState<string | null>(existing?.photoRef ?? null)
  const [photoName, setPhotoName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedAt, setSubmittedAt] = useState<string | null>(
    existing?.submittedAt ?? null
  )

  // Can submit if role has permission
  const canSubmit = ['DISTRICT', 'PROJECT_OFFICER', 'FIELD_OFFICER', 'CENTRAL', 'STATE'].includes(activeRole)

  // ── GPS capture ────────────────────────────────────────────────────────────

  const captureGPS = useCallback(() => {
    setGpsError(null)
    if (!navigator.geolocation) {
      // Use demo coordinates near the parcel centroid
      const demoLat = task.parcel?.lat ?? 15.1401
      const demoLng = task.parcel?.lng ?? 76.9200
      setGps({ lat: demoLat, lng: demoLng, accuracy: null, source: 'demo' })
      return
    }

    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6)),
          accuracy: parseFloat(pos.coords.accuracy.toFixed(1)),
          source: 'browser',
        })
        setGpsLoading(false)
      },
      (err) => {
        // Fallback to demo coordinates
        const demoLat = task.parcel?.lat ?? 15.1401
        const demoLng = task.parcel?.lng ?? 76.9200
        setGps({ lat: demoLat, lng: demoLng, accuracy: null, source: 'demo' })
        setGpsError(`GPS unavailable (${err.message}) — using demo coordinates`)
        setGpsLoading(false)
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }, [task.parcel])

  // ── Photo upload ───────────────────────────────────────────────────────────

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // In prototype: store file name as reference (no actual cloud upload)
    setPhotoName(file.name)
    setPhotoRef(`local:${file.name}:${Date.now()}`)
  }, [])

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!task.parcel) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/field-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-role': activeRole,
        },
        body: JSON.stringify({
          taskId: task.id,
          parcelId: task.parcel.id,
          checklistParcelId: checklist.parcelId,
          checklistBoundary: checklist.boundary,
          checklistArea: checklist.area,
          checklistLandUse: checklist.landUse,
          checklistOwnership: checklist.ownership,
          checklistEncumbrance: checklist.encumbrance,
          remarks: remarks.trim() || null,
          gpsLat: gps.lat,
          gpsLng: gps.lng,
          gpsAccuracy: gps.accuracy,
          photoRef,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Submission failed')
        return
      }

      setSubmitted(true)
      setSubmittedAt(new Date().toISOString())
    } catch (err: unknown) {
      setSubmitError('Network error. Please retry.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const checkedCount = Object.values(checklist).filter(Boolean).length
  const allChecked = checkedCount === 6

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-5">
      {/* Back */}
      <Link
        href="/field-verification"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Field Verification Tasks
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
          <CheckSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Field Verification
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {task.parcel?.parcelCode ?? 'No parcel assigned'} · {task.project?.name}
          </p>
        </div>
        {task.resolved && submitted || (task.resolved && existing) ? (
          <Badge variant="success" className="ml-auto shrink-0 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Verified
          </Badge>
        ) : (
          <Badge variant="warning" className="ml-auto shrink-0 gap-1">
            <Clock className="h-3 w-3" /> Pending
          </Badge>
        )}
      </div>

      {/* ── SUBMITTED SUCCESS STATE ─────────────────────────────────────────── */}
      {(submitted || (task.resolved && existing && !submitted)) && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">
              {submitted ? 'Verification submitted successfully!' : 'Verification already submitted'}
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300 ml-7">
            Submitted{' '}
            {submittedAt
              ? new Date(submittedAt).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
              : ''}{' '}
            · Verifier role: {existing?.verifierRole ?? activeRole}
          </p>
          {submitted && (
            <div className="mt-3 flex gap-2">
              <Link
                href="/field-verification"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Tasks
              </Link>
              <button
                onClick={() => { setSubmitted(false) }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Re-submit
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PARCEL INFO ─────────────────────────────────────────────────────── */}
      {task.parcel && (
        <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" /> Parcel Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <div className="text-[10px] font-medium uppercase text-slate-400">Parcel ID</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {task.parcel.parcelCode}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase text-slate-400">Survey No.</div>
                <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
                  {task.parcel.surveyNumber}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase text-slate-400">Area</div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {task.parcel.areaAcres} Acres
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase text-slate-400">Village</div>
                <div className="text-sm text-slate-700 dark:text-slate-300">{task.parcel.village}</div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase text-slate-400">District</div>
                <div className="text-sm text-slate-700 dark:text-slate-300">{task.parcel.district}</div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase text-slate-400">State</div>
                <div className="text-sm text-slate-700 dark:text-slate-300">{task.parcel.state}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-medium uppercase text-slate-400">Status:</span>
              {acqStatusBadge(task.parcel.acquisitionStatus)}
              <span className="text-[10px] font-medium uppercase text-slate-400 ml-2">Legal:</span>
              <Badge variant={task.parcel.legalStatus === 'NONE' ? 'success' : 'destructive'} className="text-[10px]">
                {task.parcel.legalStatus}
              </Badge>
            </div>

            {/* Project */}
            {task.project && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{task.project.name}</span>
                <span>·</span>
                <span>{task.project.type}</span>
              </div>
            )}

            {/* Owner */}
            {task.parcel.owner && (
              <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                <User className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {task.parcel.owner.name}
                  </span>
                  {task.parcel.owner.contactInfo?.phone && (
                    <span className="ml-2">{task.parcel.owner.contactInfo.phone}</span>
                  )}
                </div>
              </div>
            )}

            {/* Compensation */}
            {task.parcel.compensation && (
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div>
                  <div className="text-[10px] font-medium uppercase text-slate-400">Compensation</div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {formatINR(task.parcel.compensation.assessedAmount)} assessed ·{' '}
                    {formatINR(task.parcel.compensation.paidAmount)} paid
                  </div>
                </div>
                <Badge
                  variant={task.parcel.compensation.status === 'FULLY_PAID' ? 'success' : 'warning'}
                  className="ml-auto text-[10px] shrink-0"
                >
                  {task.parcel.compensation.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── GPS LOCATION ────────────────────────────────────────────────────── */}
      <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" /> Location / GPS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Parcel reference coordinates */}
          {task.parcel?.lat != null && task.parcel?.lng != null && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">Parcel centroid:</span>{' '}
              <span className="font-mono">{task.parcel.lat}°N, {task.parcel.lng}°E</span>
            </div>
          )}

          {gps.source !== 'none' && (
            <div className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
              gps.source === 'demo'
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
            )}>
              <Navigation className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">
                  {gps.source === 'demo' ? '⚠ Demo Coordinates' : '✓ GPS Captured'}
                </div>
                <div className="font-mono mt-0.5">
                  Lat: {gps.lat} · Lng: {gps.lng}
                  {gps.accuracy != null && ` · Accuracy: ±${gps.accuracy}m`}
                </div>
              </div>
            </div>
          )}

          {gpsError && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={captureGPS}
            disabled={gpsLoading || !canSubmit}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {gpsLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Navigation className="h-3.5 w-3.5" />
            )}
            {gps.source !== 'none' ? 'Re-capture Location' : 'Capture GPS Location'}
          </button>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Uses browser Geolocation API. Falls back to demo coordinates if GPS is unavailable.
          </p>
        </CardContent>
      </Card>

      {/* ── VERIFICATION FORM ───────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Checklist */}
        <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <CheckSquare className="h-3.5 w-3.5" /> Verification Checklist
              </CardTitle>
              <span className={cn(
                'text-xs font-bold',
                allChecked ? 'text-emerald-600' : 'text-slate-500'
              )}>
                {checkedCount}/6 Verified
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {([
              { key: 'parcelId', label: 'Parcel identity verified' },
              { key: 'boundary', label: 'Land boundary verified' },
              { key: 'area', label: 'Land area verified' },
              { key: 'landUse', label: 'Land use verified' },
              { key: 'ownership', label: 'Ownership / record information verified' },
              { key: 'encumbrance', label: 'Encumbrance / dispute checked' },
            ] as { key: keyof ChecklistState; label: string }[]).map(item => (
              <ChecklistItem
                key={item.key}
                label={item.label}
                checked={checklist[item.key]}
                onToggle={() => {
                  if (canSubmit) {
                    setChecklist(prev => ({ ...prev, [item.key]: !prev[item.key] }))
                  }
                }}
                disabled={!canSubmit}
              />
            ))}
          </CardContent>
        </Card>

        {/* Evidence / Photo */}
        <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Camera className="h-3.5 w-3.5" /> Evidence / Photo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {photoName && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-900 dark:bg-blue-950/30">
                <Camera className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-medium text-blue-800 dark:text-blue-200 truncate">{photoName}</span>
                <Badge variant="info" className="text-[10px] ml-auto shrink-0">Prototype ref</Badge>
              </div>
            )}
            {existing?.photoRef && !photoName && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
                <Camera className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-medium text-emerald-800 dark:text-emerald-200 truncate">
                  {existing.photoRef.replace('local:', '').split(':')[0]}
                </span>
                <Badge variant="success" className="text-[10px] ml-auto shrink-0">Previously attached</Badge>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoChange}
              disabled={!canSubmit}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors disabled:opacity-60 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500"
            >
              <Upload className="h-4 w-4" />
              {photoName ? 'Change photo / evidence' : 'Upload photo or evidence'}
            </button>
            <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
              Prototype: file is referenced locally. No cloud upload is performed.
            </p>
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card className="border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Remarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              id="verification-remarks"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              disabled={!canSubmit}
              placeholder="Enter field verification observations, discrepancies, or notes..."
              rows={4}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder:text-slate-600"
            />
          </CardContent>
        </Card>

        {/* Role access warning */}
        {!canSubmit && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Current role <strong>{activeRole}</strong> cannot submit field verifications.
              Switch to Field Officer, District, or Project Officer role.
            </span>
          </div>
        )}

        {/* Submit error */}
        {submitError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Submit button */}
        {!submitted && (
          <button
            type="submit"
            disabled={submitting || !canSubmit || !task.parcel}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold tracking-wide transition-all shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              canSubmit && task.parcel
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 hover:shadow-md'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
            )}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting ? 'Submitting…' : 'Submit Verification'}
          </button>
        )}
      </form>

      {/* Bottom padding for mobile */}
      <div className="h-8" />
    </main>
  )
}
