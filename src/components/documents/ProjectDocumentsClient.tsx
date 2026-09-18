'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  Eye,
  X,
  Sparkles,
  ShieldAlert,
  Building2,
  Scale,
  MapPin,
  RefreshCw,
  User,
  Calendar,
  AlertOctagon,
  Check,
  FileCheck2,
  FileSearch,
  ArrowUpDown,
  Layers
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from '@/components/ui/table'
import { formatNumber } from '@/lib/utils'

export interface DocumentItem {
  id: string
  type: string
  status: 'PENDING' | 'VERIFIED' | 'MISMATCH'
  hasMismatch: boolean
  mismatchedFields: string[]
  extractedFields: any
  dbComparisonResult: any
  createdAt: string
  updatedAt: string
  parcel: {
    id: string
    parcelCode: string
    surveyNumber: string
    village: string
    district: string
    state: string
    areaAcres: number
    acquisitionStatus: string
    ownerName: string
    contactInfo?: any
  }
}

export interface DocumentStats {
  total: number
  verified: number
  pending: number
  mismatch: number
  byType: Record<string, number>
}

interface ProjectInfo {
  id: string
  name: string
  type: string
  state: string
  district: string
}

interface ProjectDocumentsClientProps {
  project: ProjectInfo
  initialDocuments: DocumentItem[]
  initialStats: DocumentStats
}

interface FieldAudit {
  field: string
  label: string
  dbValue: string
  extractedValue: string
  isMatch: boolean
  difference?: string
}

export function ProjectDocumentsClient({
  project,
  initialDocuments,
  initialStats
}: ProjectDocumentsClientProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments)
  const [stats, setStats] = useState<DocumentStats>(initialStats)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [selectedDocDetails, setSelectedDocDetails] = useState<any | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MISMATCH' | 'VERIFIED' | 'PENDING'>('ALL')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Trigger Toast Notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  // Open drawer and fetch full document details if needed
  const handleOpenDoc = async (doc: DocumentItem) => {
    setSelectedDocId(doc.id)
    setIsDrawerOpen(true)
    setDrawerLoading(true)

    try {
      const res = await fetch(`/api/documents/${doc.id}`)
      if (!res.ok) throw new Error('Failed to fetch document details')
      const data = await res.json()
      setSelectedDocDetails(data)
    } catch (err) {
      console.error(err)
      // Fallback to client-calculated comparison if API fails
      setSelectedDocDetails(doc)
    } finally {
      setDrawerLoading(false)
    }
  }

  // Quick Demo Jump to NKIC-0001 Survey document
  const handleJumpToDemoDoc = () => {
    const demoDoc = documents.find(
      (d) => d.parcel.parcelCode === 'NKIC-0001' && d.type === 'SURVEY' && d.hasMismatch
    )
    if (demoDoc) {
      handleOpenDoc(demoDoc)
    } else {
      // If filtered out, reset filters
      setStatusFilter('ALL')
      setTypeFilter('ALL')
      setSearchQuery('NKIC-0001')
      const found = initialDocuments.find(
        (d) => d.parcel.parcelCode === 'NKIC-0001' && d.type === 'SURVEY'
      )
      if (found) handleOpenDoc(found)
    }
  }

  // Client-side filtering for fast instant responsiveness
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      // Status Filter
      if (statusFilter === 'MISMATCH' && !doc.hasMismatch) return false
      if (statusFilter === 'VERIFIED' && (doc.status !== 'VERIFIED' || doc.hasMismatch)) return false
      if (statusFilter === 'PENDING' && doc.status !== 'PENDING') return false

      // Type Filter
      if (typeFilter !== 'ALL' && doc.type !== typeFilter) return false

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesCode = doc.parcel.parcelCode.toLowerCase().includes(q)
        const matchesOwner = doc.parcel.ownerName.toLowerCase().includes(q)
        const matchesSurvey = doc.parcel.surveyNumber.toLowerCase().includes(q)
        const matchesId = doc.id.toLowerCase().includes(q)
        if (!matchesCode && !matchesOwner && !matchesSurvey && !matchesId) return false
      }

      return true
    })
  }, [documents, statusFilter, typeFilter, searchQuery])

  // Get Demo Document reference for the top banner
  const demoDocument = useMemo(() => {
    return initialDocuments.find(
      (d) => d.parcel.parcelCode === 'NKIC-0001' && d.type === 'SURVEY' && d.hasMismatch
    )
  }, [initialDocuments])

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-blue-800 bg-slate-900 px-4 py-3 text-xs font-semibold text-blue-200 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-5">
          <Sparkles className="h-4 w-4 text-blue-400" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* CORE DEMO SHOWCASE BANNER: NKIC-0001 Survey Discrepancy */}
      {demoDocument && (
        <div className="relative overflow-hidden rounded-xl border border-rose-800/80 bg-gradient-to-r from-rose-950/60 via-slate-900/90 to-slate-950 p-5 shadow-lg dark:border-rose-900/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="rounded-lg bg-rose-500/20 p-2.5 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-white">
                    Core Demo Discrepancy: Cadastral Survey vs Database Mismatch
                  </span>
                  <Badge variant="destructive" className="text-[10px] uppercase font-mono py-0">
                    Audit Flag
                  </Badge>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed max-w-2xl">
                  Automated Document AI detected a critical land area divergence on{' '}
                  <span className="font-semibold font-mono text-white">NKIC-0001</span> (Owner:{' '}
                  <span className="text-white font-medium">Ramesh Kumar Patil</span>). Record of Rights
                  database records <span className="font-bold text-white">2.50 acres</span>, whereas
                  scanned survey document indicates <span className="font-bold text-rose-300">2.10 acres</span>{' '}
                  (<span className="font-bold text-rose-400">-0.40 acres / -16.0%</span> variance).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center shrink-0">
              <button
                onClick={handleJumpToDemoDoc}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 active:scale-95 transition-all"
              >
                <FileSearch className="h-4 w-4" />
                <span>Inspect NKIC-0001 Discrepancy</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Total Documents</span>
              <FileText className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {formatNumber(stats.total)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Across 2,000 project parcels
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200/60 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-rose-600 dark:text-rose-400">
              <span>Mismatches Detected</span>
              <AlertOctagon className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
              {formatNumber(stats.mismatch)}
            </div>
            <div className="mt-1 text-[11px] text-rose-700/80 dark:text-rose-400/80 font-medium">
              Requires field officer review
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span>Verified Matches</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatNumber(stats.verified)}
            </div>
            <div className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              Automated OCR reconciliation complete
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-amber-600 dark:text-amber-400">
              <span>Pending Processing</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
              {formatNumber(stats.pending)}
            </div>
            <div className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/80">
              Awaiting OCR ingestion queue
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar: Filters, Search & Type Dropdown */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span>All Documents</span>
                <span className="font-mono text-[10px] opacity-75">({stats.total})</span>
              </button>

              <button
                onClick={() => setStatusFilter('MISMATCH')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === 'MISMATCH'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Mismatch Detected</span>
                <span className="font-mono text-[10px] opacity-90">({stats.mismatch})</span>
              </button>

              <button
                onClick={() => setStatusFilter('VERIFIED')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === 'VERIFIED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Verified Match</span>
                <span className="font-mono text-[10px] opacity-90">({stats.verified})</span>
              </button>

              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Pending</span>
                <span className="font-mono text-[10px] opacity-90">({stats.pending})</span>
              </button>
            </div>

            {/* Right: Search & Type Select */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Type Filter */}
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="ALL">All Document Types</option>
                  <option value="SURVEY">Cadastral Survey</option>
                  <option value="OWNERSHIP">Ownership Deed / RoR</option>
                  <option value="NOTIFICATION">Gazette Notification</option>
                  <option value="COMPENSATION">Compensation Award</option>
                  <option value="LEGAL">Court Order / Legal Notice</option>
                  <option value="RR">R&R Entitlement Record</option>
                </select>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search parcel code, owner, survey..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 sm:w-64 rounded-md border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Data Table */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Document Verification Registry</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Showing {filteredDocuments.length} of {stats.total} total documents
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
              <span>Mismatch Detected</span>
              <span className="mx-1">•</span>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>Verified Match</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70 dark:bg-slate-900/60">
                  <TableHead className="w-[120px]">Parcel Code</TableHead>
                  <TableHead className="w-[180px]">Landowner</TableHead>
                  <TableHead className="w-[140px]">Document Type</TableHead>
                  <TableHead className="w-[130px]">Survey Number</TableHead>
                  <TableHead className="w-[110px]">Registry Area</TableHead>
                  <TableHead className="w-[170px]">Verification Status</TableHead>
                  <TableHead className="w-[170px]">Audit Discrepancy</TableHead>
                  <TableHead className="w-[100px] text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <FileText className="h-6 w-6 text-slate-400" />
                        <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                          No matching documents found
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Try adjusting your search criteria or status filter
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((doc) => {
                    const isDemoItem = doc.parcel.parcelCode === 'NKIC-0001' && doc.type === 'SURVEY' && doc.hasMismatch
                    return (
                      <TableRow
                        key={doc.id}
                        className={`cursor-pointer transition-colors ${
                          isDemoItem
                            ? 'bg-rose-50/40 hover:bg-rose-100/50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                        onClick={() => handleOpenDoc(doc)}
                      >
                        {/* Parcel Code */}
                        <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{doc.parcel.parcelCode}</span>
                            {isDemoItem && (
                              <span className="inline-flex items-center rounded bg-rose-600 px-1 py-0.2 text-[9px] font-bold text-white uppercase">
                                DEMO
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Landowner */}
                        <TableCell>
                          <div className="font-medium text-xs text-slate-900 dark:text-slate-100">
                            {doc.parcel.ownerName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {doc.parcel.village}
                          </div>
                        </TableCell>

                        {/* Document Type */}
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] uppercase font-semibold">
                            {doc.type}
                          </Badge>
                        </TableCell>

                        {/* Survey Number */}
                        <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-300">
                          {doc.parcel.surveyNumber}
                        </TableCell>

                        {/* Land Area */}
                        <TableCell className="font-mono text-xs font-medium text-slate-900 dark:text-white">
                          {doc.parcel.areaAcres} ac
                        </TableCell>

                        {/* Verification Status */}
                        <TableCell>
                          {doc.hasMismatch ? (
                            <Badge variant="destructive" className="gap-1 font-semibold text-[11px] py-0.5">
                              <AlertOctagon className="h-3 w-3" />
                              Mismatch Detected
                            </Badge>
                          ) : doc.status === 'VERIFIED' ? (
                            <Badge variant="success" className="gap-1 font-semibold text-[11px] py-0.5">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="gap-1 font-semibold text-[11px] py-0.5">
                              <Clock className="h-3 w-3" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>

                        {/* Discrepancy details */}
                        <TableCell>
                          {doc.hasMismatch ? (
                            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {doc.mismatchedFields.includes('landArea')
                                  ? 'Area: DB 2.5 vs Doc 2.1 ac'
                                  : doc.mismatchedFields.join(', ')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                              — No variance
                            </span>
                          )}
                        </TableCell>

                        {/* Action CTA */}
                        <TableCell className="text-right pr-6">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenDoc(doc)
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Eye className="h-3 w-3 text-blue-500" />
                            <span>Audit</span>
                          </button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* SIDE-BY-SIDE COMPARISON SLIDE-OVER DRAWER */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                    <FileSearch className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Document Intelligence Audit</span>
                      {selectedDocDetails?.hasMismatch && (
                        <Badge variant="destructive" className="text-[10px] uppercase font-mono py-0">
                          Discrepancy Found
                        </Badge>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      OCR Extracted Metadata vs Land Registry Database Comparison
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {drawerLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="text-xs font-semibold text-slate-500">Loading document audit...</span>
                  </div>
                ) : selectedDocDetails ? (
                  <>
                    {/* Document Meta Header Summary Card */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Cadastral Parcel
                          </div>
                          <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {selectedDocDetails.parcel.parcelCode}
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Document Type
                          </div>
                          <Badge variant="outline" className="font-mono text-xs font-semibold">
                            {selectedDocDetails.type}
                          </Badge>
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Status
                          </div>
                          {selectedDocDetails.hasMismatch ? (
                            <Badge variant="destructive" className="font-bold text-[10px]">
                              MISMATCH DETECTED
                            </Badge>
                          ) : (
                            <Badge variant="success" className="font-bold text-[10px]">
                              VERIFIED MATCH
                            </Badge>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Document ID
                          </div>
                          <code className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {selectedDocDetails.id.slice(0, 8)}...
                          </code>
                        </div>
                      </div>

                      {/* Location & Ownership */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400">Landowner:</span>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {selectedDocDetails.parcel.owner?.name || selectedDocDetails.parcel.ownerName}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Survey Number:</span>
                          <div className="font-mono font-semibold text-slate-900 dark:text-white">
                            {selectedDocDetails.parcel.surveyNumber}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400">Village / District:</span>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {selectedDocDetails.parcel.village}, {selectedDocDetails.parcel.district}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Prominent Discrepancy Banner in Drawer */}
                    {selectedDocDetails.hasMismatch && (
                      <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-rose-200 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
                          <ShieldAlert className="h-4 w-4" />
                          <span>Discrepancy Detected — Field Audit Required</span>
                        </div>
                        <p className="text-xs text-rose-300/90 leading-relaxed">
                          Automated OCR document parsing extracted values that conflict with the government land
                          record database. Review the side-by-side comparison below to authorize field verification or
                          adjust the acquisition award.
                        </p>
                      </div>
                    )}

                    {/* SIDE-BY-SIDE FIELD COMPARISON TABLE */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-blue-500" />
                          <span>Field-by-Field Audit Comparison</span>
                        </h3>
                        <span className="text-[11px] text-slate-400">
                          Strict Tolerance: ±0.01 Acres
                        </span>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-200">
                                Field Name
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-200">
                                Database Record (RoR)
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-200">
                                Extracted from Document
                              </th>
                              <th className="px-4 py-3 text-left font-bold text-slate-700 dark:text-slate-200">
                                Audit Status / Variance
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {/* If structured comparisons exist from API */}
                            {selectedDocDetails.comparisons?.map((c: FieldAudit, idx: number) => {
                              return (
                                <tr
                                  key={idx}
                                  className={
                                    !c.isMatch
                                      ? 'bg-rose-50/70 dark:bg-rose-950/30'
                                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                                  }
                                >
                                  {/* Field Label */}
                                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                    {c.label}
                                  </td>

                                  {/* DB Value */}
                                  <td className="px-4 py-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                                    {c.dbValue}
                                  </td>

                                  {/* Extracted Value */}
                                  <td
                                    className={`px-4 py-3 font-mono font-medium ${
                                      !c.isMatch
                                        ? 'text-rose-600 dark:text-rose-400 font-bold'
                                        : 'text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    {c.extractedValue}
                                  </td>

                                  {/* Audit Status / Difference */}
                                  <td className="px-4 py-3">
                                    {!c.isMatch ? (
                                      <div className="space-y-0.5">
                                        <Badge
                                          variant="destructive"
                                          className="text-[10px] font-bold py-0"
                                        >
                                          MISMATCH
                                        </Badge>
                                        {c.difference && (
                                          <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                                            Difference: {c.difference}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <Badge
                                        variant="success"
                                        className="text-[10px] font-medium py-0"
                                      >
                                        MATCH
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Raw Extracted Fields JSON Preview */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>Raw OCR Extracted JSON Payload</span>
                        <span className="font-mono text-[10px]">Model: Bhoomi-OCR-v2.1</span>
                      </div>
                      <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto shadow-inner">
                        {JSON.stringify(selectedDocDetails.extractedFields, null, 2) || '// No extracted fields'}
                      </pre>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      showToast('Action logged: Flagged for Joint Field Inspection (Workflow module preview)')
                    }
                    className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 active:scale-95 transition-all"
                  >
                    Flag for Joint Inspection
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      showToast('Action logged: Extracted value accepted into record (Workflow module preview)')
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    Accept Extracted Value
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-lg border border-slate-200 bg-slate-200/80 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
