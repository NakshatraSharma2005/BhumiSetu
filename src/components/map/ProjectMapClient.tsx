'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import Link from 'next/link'
import type { Map as MapInstance } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  ArrowLeft,
  Filter,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  MapPin,
  X,
  Maximize2,
  Compass,
  Building2,
  Landmark,
  Scale,
  Users,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatINR, formatNumber } from '@/lib/utils'

export interface ParcelProperties {
  parcelId: string
  parcelCode: string
  surveyNumber: string
  village: string
  district: string
  state: string
  areaAcres: number
  acquisitionStatus: string
  legalStatus: string
  rrStatus: string
  ownerName: string
  compensationAssessed: number
  compensationPaid: number
  compensationPending: number
  compensationStatus: string
}

export interface GeoJsonFeature {
  type: 'Feature'
  id: string
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  properties: ParcelProperties
}

export interface GeoJsonData {
  type: 'FeatureCollection'
  projectId: string
  projectName: string
  totalFeatures: number
  features: GeoJsonFeature[]
}

interface ProjectMapClientProps {
  projectId: string
  projectName: string
  projectType: string
  state: string
  district: string
  totalParcels: number
}

type FilterStatus = 'ALL' | 'ACQUIRED' | 'IN_PROCESS' | 'LEGAL_DISPUTE' | 'NOT_STARTED'

export function ProjectMapClient({
  projectId,
  projectName,
  projectType,
  state,
  district,
  totalParcels
}: ProjectMapClientProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapInstance | null>(null)

  const [geojsonData, setGeojsonData] = useState<GeoJsonData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedParcel, setSelectedParcel] = useState<ParcelProperties | null>(null)
  const [currentFilter, setCurrentFilter] = useState<FilterStatus>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchError, setSearchError] = useState<string | null>(null)

  // Fetch GeoJSON once on mount
  useEffect(() => {
    let isMounted = true

    async function loadGeoJson() {
      try {
        setLoading(true)
        const res = await fetch(`/api/projects/${projectId}/parcels/geojson`)
        if (!res.ok) {
          throw new Error(`Failed to load parcels GeoJSON: ${res.statusText}`)
        }
        const data: GeoJsonData = await res.json()
        if (isMounted) {
          setGeojsonData(data)
          setLoading(false)
        }
      } catch (err: any) {
        if (isMounted) {
          console.error(err)
          setError(err.message || 'Error fetching parcel map data')
          setLoading(false)
        }
      }
    }

    loadGeoJson()
    return () => {
      isMounted = false
    }
  }, [projectId])

  // Compute status counts for filter badges
  const counts = useMemo(() => {
    if (!geojsonData?.features) return { total: 0, acquired: 0, inProcess: 0, dispute: 0, notStarted: 0 }
    let acquired = 0
    let inProcess = 0
    let dispute = 0
    let notStarted = 0

    for (const f of geojsonData.features) {
      const s = f.properties.acquisitionStatus
      if (s === 'ACQUIRED' || s === 'POSSESSION') {
        acquired++
      } else if (s === 'LEGAL_DISPUTE') {
        dispute++
      } else if (s === 'NOT_STARTED') {
        notStarted++
      } else {
        inProcess++
      }
    }

    return {
      total: geojsonData.features.length,
      acquired,
      inProcess,
      dispute,
      notStarted
    }
  }, [geojsonData])

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || !geojsonData) return
    if (mapRef.current) return // Already initialized

    let isDisposed = false

    // Dynamically import MapLibre in browser only to eliminate any Node SSR canvas/window errors
    import('maplibre-gl').then(({ Map, NavigationControl, setWorkerUrl }) => {
      // Point to static worker script served from /public
      // maplibre-gl-worker.mjs and its dependency maplibre-gl-shared.mjs are both in /public
      setWorkerUrl('/maplibre-gl-worker.mjs')

      if (isDisposed || !mapContainerRef.current) return

      // Calculate bounding box from parcel geometries
      let minLng = 180
      let maxLng = -180
      let minLat = 90
      let maxLat = -90

      for (const f of geojsonData.features) {
        if (f.geometry?.coordinates?.[0]) {
          for (const [lng, lat] of f.geometry.coordinates[0]) {
            if (lng < minLng) minLng = lng
            if (lng > maxLng) maxLng = lng
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
          }
        }
      }

      const hasBounds = minLng < maxLng && minLat < maxLat
      const defaultCenter: [number, number] = hasBounds
        ? [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
        : [76.92, 15.14]

      // Base map: Carto Positron GL — free vector style, no API key required
      console.log('ProjectMapClient: Creating new Map instance')
      console.log('ProjectMapClient: Container ref current:', mapContainerRef.current)
      const map = new Map({
        container: mapContainerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: defaultCenter,
        zoom: hasBounds ? 12.5 : 13,
        pitch: 0,
        maxPitch: 60
      })
      console.log('ProjectMapClient: Map instance created:', map)

      map.addControl(new NavigationControl({ showCompass: true }), 'top-right')

      // Catch style/tile/worker errors so they appear in console if load never fires
      map.on('error', (e) => {
        console.error('ProjectMapClient: MapLibre error:', e.error)
      })

      map.on('load', () => {
        console.log('ProjectMapClient: Map load event fired')
        if (isDisposed) {
          map.remove()
          return
        }

        // Add GeoJSON source
        map.addSource('parcels-source', {
          type: 'geojson',
          data: geojsonData as any,
          generateId: true
        })

        // 1. Fill Layer with acquisitionStatus coloring
        // 🟢 ACQUIRED = green (#10b981)
        // 🟡 In Process = yellow/amber (#f59e0b)
        // 🔴 LEGAL_DISPUTE = red (#ef4444)
        // ⚪ NOT_STARTED = slate/gray (#94a3b8)
        map.addLayer({
          id: 'parcels-fill',
          type: 'fill',
          source: 'parcels-source',
          paint: {
            'fill-color': [
              'match',
              ['get', 'acquisitionStatus'],
              'ACQUIRED', '#10b981',
              'POSSESSION', '#10b981',
              'LEGAL_DISPUTE', '#ef4444',
              'NOT_STARTED', '#94a3b8',
              /* All in-process statuses default to yellow */
              '#f59e0b'
            ],
            'fill-opacity': 0.68
          }
        })

        // 2. Line Layer (Cadastral plot boundaries)
        map.addLayer({
          id: 'parcels-line',
          type: 'line',
          source: 'parcels-source',
          paint: {
            'line-color': [
              'match',
              ['get', 'acquisitionStatus'],
              'ACQUIRED', '#047857',
              'POSSESSION', '#047857',
              'LEGAL_DISPUTE', '#b91c1c',
              'NOT_STARTED', '#475569',
              '#b45309'
            ],
            'line-width': 1.2
          }
        })

        // 3. Highlight Layer for selected parcel
        map.addLayer({
          id: 'parcels-selected-outline',
          type: 'line',
          source: 'parcels-source',
          filter: ['==', ['get', 'parcelCode'], ''],
          paint: {
            'line-color': '#2563eb',
            'line-width': 3.5
          }
        })

        // Fit map to parcel corridor extent
        if (hasBounds) {
          map.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat]
            ],
            { padding: 60, duration: 1000 }
          )
        }

        // Cursor pointer on hover
        map.on('mouseenter', 'parcels-fill', () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'parcels-fill', () => {
          map.getCanvas().style.cursor = ''
        })

        // Click parcel polygon to view details
        map.on('click', 'parcels-fill', (e) => {
          if (!e.features || e.features.length === 0) return
          const feature = e.features[0]
          const props = feature.properties as unknown as ParcelProperties

          setSelectedParcel(props)
          map.setFilter('parcels-selected-outline', ['==', ['get', 'parcelCode'], props.parcelCode])
        })

        // Add error handler for tile loading issues
        map.on('error', (e) => {
          console.error('ProjectMapClient: MapLibre error:', e)
        })
      })

      mapRef.current = map
    }).catch((importError) => {
      console.error('ProjectMapClient: Failed to import maplibre-gl:', importError)
    })

    return () => {
      isDisposed = true
      if (mapRef.current) {
        console.log('ProjectMapClient: Cleaning up map instance')
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [geojsonData])

  // Filter handler (uses MapLibre's setFilter without refetching)
  const applyFilter = (filter: FilterStatus) => {
    setCurrentFilter(filter)
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    let mapFilter: any = null

    switch (filter) {
      case 'ACQUIRED':
        mapFilter = [
          'any',
          ['==', ['get', 'acquisitionStatus'], 'ACQUIRED'],
          ['==', ['get', 'acquisitionStatus'], 'POSSESSION']
        ]
        break
      case 'IN_PROCESS':
        mapFilter = [
          'all',
          ['!=', ['get', 'acquisitionStatus'], 'ACQUIRED'],
          ['!=', ['get', 'acquisitionStatus'], 'POSSESSION'],
          ['!=', ['get', 'acquisitionStatus'], 'LEGAL_DISPUTE'],
          ['!=', ['get', 'acquisitionStatus'], 'NOT_STARTED']
        ]
        break
      case 'LEGAL_DISPUTE':
        mapFilter = ['==', ['get', 'acquisitionStatus'], 'LEGAL_DISPUTE']
        break
      case 'NOT_STARTED':
        mapFilter = ['==', ['get', 'acquisitionStatus'], 'NOT_STARTED']
        break
      case 'ALL':
      default:
        mapFilter = null
        break
    }

    map.setFilter('parcels-fill', mapFilter)
    map.setFilter('parcels-line', mapFilter)
  }

  // Jump to specific parcel code (e.g. NKIC-0001)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchError(null)
    const code = searchQuery.trim().toUpperCase()
    if (!code || !geojsonData) return

    const target = geojsonData.features.find(
      (f) => f.properties.parcelCode.toUpperCase() === code
    )

    if (!target) {
      setSearchError(`Parcel "${code}" not found in this project.`)
      return
    }

    setSelectedParcel(target.properties)

    const map = mapRef.current
    if (map) {
      map.setFilter('parcels-selected-outline', ['==', ['get', 'parcelCode'], target.properties.parcelCode])

      // Compute centroid of the polygon coordinates
      const coords = target.geometry.coordinates[0]
      let sumLng = 0
      let sumLat = 0
      for (const [lng, lat] of coords) {
        sumLng += lng
        sumLat += lat
      }
      const centerLng = sumLng / coords.length
      const centerLat = sumLat / coords.length

      map.flyTo({
        center: [centerLng, centerLat],
        zoom: 16.5,
        duration: 1200,
        essential: true
      })
    }
  }

  // Zoom back out to fit whole corridor
  const handleFitCorridor = () => {
    const map = mapRef.current
    if (!map || !geojsonData) return

    let minLng = 180
    let maxLng = -180
    let minLat = 90
    let maxLat = -90

    for (const f of geojsonData.features) {
      if (f.geometry?.coordinates?.[0]) {
        for (const [lng, lat] of f.geometry.coordinates[0]) {
          if (lng < minLng) minLng = lng
          if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        }
      }
    }

    if (minLng < maxLng && minLat < maxLat) {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat]
        ],
        { padding: 60, duration: 1000 }
      )
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-900 text-slate-100">
      {/* Top Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-2.5 z-20 shadow-md">
        {/* Left: Back & Project Info */}
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>

          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">{projectName}</span>
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] border-slate-700 py-0">
                {projectType}
              </Badge>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <MapPin className="h-3 w-3 text-slate-500" />
              <span>{district ? `${district}, ` : ''}{state}</span>
              <span>•</span>
              <span className="font-mono text-emerald-400 font-medium">
                {counts.total > 0 ? `${formatNumber(counts.total)} Cadastral Parcels` : 'Loading...'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Search / Jump to Parcel */}
        <form onSubmit={handleSearch} className="flex items-center gap-1.5 relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Jump to parcel (e.g. NKIC-0001)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 rounded-md border border-slate-800 bg-slate-900/90 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Go
          </button>
          {searchError && (
            <div className="absolute top-10 right-0 bg-rose-950 border border-rose-800 text-rose-300 text-[11px] px-2 py-1 rounded shadow-lg z-30">
              {searchError}
            </div>
          )}
        </form>

        {/* Right: Quick Zoom to Corridor */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFitCorridor}
            className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            title="Fit Entire Project Corridor"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Fit Corridor</span>
          </button>
        </div>
      </div>

      {/* Filter Status Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 bg-slate-900/90 px-4 py-2 text-xs z-10">
        <div className="flex items-center gap-1 text-slate-400 text-[11px] font-semibold uppercase tracking-wider pr-2 border-r border-slate-800">
          <Filter className="h-3 w-3" />
          <span>Filter:</span>
        </div>

        {/* All */}
        <button
          onClick={() => applyFilter('ALL')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
            currentFilter === 'ALL'
              ? 'bg-slate-100 text-slate-950 shadow-sm'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span>All Parcels</span>
          <span className="font-mono text-[10px] opacity-80">({counts.total})</span>
        </button>

        {/* Acquired */}
        <button
          onClick={() => applyFilter('ACQUIRED')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
            currentFilter === 'ACQUIRED'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
              : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/50'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Acquired</span>
          <span className="font-mono text-[10px] opacity-80">({counts.acquired})</span>
        </button>

        {/* In Process */}
        <button
          onClick={() => applyFilter('IN_PROCESS')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
            currentFilter === 'IN_PROCESS'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'bg-amber-950/40 text-amber-300 border border-amber-800/50 hover:bg-amber-900/50'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>In Process</span>
          <span className="font-mono text-[10px] opacity-80">({counts.inProcess})</span>
        </button>

        {/* Legal Dispute */}
        <button
          onClick={() => applyFilter('LEGAL_DISPUTE')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
            currentFilter === 'LEGAL_DISPUTE'
              ? 'bg-rose-500 text-white font-bold shadow-sm'
              : 'bg-rose-950/40 text-rose-300 border border-rose-800/50 hover:bg-rose-900/50'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          <span>Legal Dispute</span>
          <span className="font-mono text-[10px] opacity-80">({counts.dispute})</span>
        </button>

        {/* Not Started */}
        <button
          onClick={() => applyFilter('NOT_STARTED')}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
            currentFilter === 'NOT_STARTED'
              ? 'bg-slate-400 text-slate-950 font-bold shadow-sm'
              : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <span>Not Started</span>
          <span className="font-mono text-[10px] opacity-80">({counts.notStarted})</span>
        </button>
      </div>

      {/* Main Map Canvas Area with Floating HUD */}
      <div className="relative flex-1 w-full h-full">
        {/* Loading Indicator */}
        {loading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mb-3" />
            <div className="text-sm font-semibold text-slate-200">Loading Cadastral Parcel Geometries...</div>
            <div className="text-xs text-slate-400 mt-1">Rendering 2,000 real-coordinate polygons via MapLibre GL</div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="max-w-md rounded-xl border border-rose-800 bg-rose-950 p-6 text-center shadow-xl">
              <ShieldAlert className="h-8 w-8 text-rose-400 mx-auto mb-2" />
              <h3 className="font-bold text-white text-base">Failed to Load Map Data</h3>
              <p className="text-xs text-rose-300 mt-2">{error}</p>
            </div>
          </div>
        )}

        {/* Map Container */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Legend (Bottom-Left) */}
        <div className="absolute bottom-6 left-6 z-10 rounded-xl border border-slate-800/90 bg-slate-950/90 p-3.5 shadow-xl backdrop-blur-md max-w-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-bold text-white uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              Cadastral Legend
            </span>
            <span className="text-[10px] text-slate-400 font-mono font-normal">2k Plots</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-xs bg-emerald-500 border border-emerald-400/80" />
                <span className="text-slate-200">Acquired / Possession</span>
              </div>
              <span className="font-mono text-[11px] text-emerald-400 font-semibold">{counts.acquired}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-xs bg-amber-500 border border-amber-400/80" />
                <span className="text-slate-200">In Process (Verification/Obj)</span>
              </div>
              <span className="font-mono text-[11px] text-amber-400 font-semibold">{counts.inProcess}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-xs bg-rose-500 border border-rose-400/80" />
                <span className="text-slate-200">Legal Dispute (Litigation)</span>
              </div>
              <span className="font-mono text-[11px] text-rose-400 font-semibold">{counts.dispute}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-xs bg-slate-400 border border-slate-300/80" />
                <span className="text-slate-200">Not Started (Initial Notice)</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400 font-semibold">{counts.notStarted}</span>
            </div>
          </div>
        </div>

        {/* Interactive Parcel Detail Side Panel (Slides in on right when a parcel is clicked) */}
        {selectedParcel && (
          <div className="absolute top-4 right-4 bottom-4 w-96 max-w-[calc(100vw-32px)] z-20 flex flex-col rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-md overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-white">
                  {selectedParcel.parcelCode}
                </span>
                {selectedParcel.parcelCode === 'NKIC-0001' && (
                  <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/40">
                    <Sparkles className="h-2.5 w-2.5" />
                    Demo Benchmark
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedParcel(null)
                  if (mapRef.current) {
                    mapRef.current.setFilter('parcels-selected-outline', ['==', ['get', 'parcelCode'], ''])
                  }
                }}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Status Header */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Acquisition Status</span>
                  {selectedParcel.acquisitionStatus === 'ACQUIRED' || selectedParcel.acquisitionStatus === 'POSSESSION' ? (
                    <Badge variant="success" className="font-semibold text-xs">
                      {selectedParcel.acquisitionStatus}
                    </Badge>
                  ) : selectedParcel.acquisitionStatus === 'LEGAL_DISPUTE' ? (
                    <Badge variant="destructive" className="font-semibold text-xs">
                      LEGAL DISPUTE
                    </Badge>
                  ) : selectedParcel.acquisitionStatus === 'NOT_STARTED' ? (
                    <Badge variant="secondary" className="font-semibold text-xs">
                      NOT STARTED
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="font-semibold text-xs">
                      {selectedParcel.acquisitionStatus}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400">Cadastral Plot Area</span>
                  <span className="font-bold text-white text-sm">{selectedParcel.areaAcres} Acres</span>
                </div>
              </div>

              {/* Ownership & Location */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2.5">
                <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                  <Building2 className="h-3.5 w-3.5 text-blue-400" />
                  Landowner & Survey Details
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Primary Landowner:</span>
                    <span className="font-semibold text-white">{selectedParcel.ownerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Revenue Survey No:</span>
                    <span className="font-mono text-slate-200">{selectedParcel.surveyNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Revenue Village:</span>
                    <span className="text-slate-200">{selectedParcel.village}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">District / State:</span>
                    <span className="text-slate-200">{selectedParcel.district}, {selectedParcel.state}</span>
                  </div>
                </div>
              </div>

              {/* Compensation Details */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2.5">
                <div className="font-bold text-slate-200 text-xs flex items-center justify-between uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="h-3.5 w-3.5 text-purple-400" />
                    Compensation Award
                  </span>
                  <Badge variant="outline" className="text-[10px] border-slate-700 py-0">
                    {selectedParcel.compensationStatus}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assessed Amount:</span>
                    <span className="font-bold text-white">{formatINR(selectedParcel.compensationAssessed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400">Amount Paid / Disbursed:</span>
                    <span className="font-bold text-emerald-400">{formatINR(selectedParcel.compensationPaid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-400">Pending Amount:</span>
                    <span className="font-bold text-amber-400">{formatINR(selectedParcel.compensationPending)}</span>
                  </div>

                  <div className="pt-1.5">
                    <div className="flex justify-between text-[11px] mb-1 text-slate-400">
                      <span>Disbursal Progress</span>
                      <span>
                        {selectedParcel.compensationAssessed > 0
                          ? Math.round((selectedParcel.compensationPaid / selectedParcel.compensationAssessed) * 100)
                          : 0}%
                      </span>
                    </div>
                    <Progress
                      value={
                        selectedParcel.compensationAssessed > 0
                          ? (selectedParcel.compensationPaid / selectedParcel.compensationAssessed) * 100
                          : 0
                      }
                      className="h-1.5 bg-slate-800"
                      indicatorClassName="bg-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Legal & R&R Badges */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-1">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Scale className="h-3 w-3 text-rose-400" />
                    <span>Legal Status</span>
                  </div>
                  <div className="font-bold text-slate-200 text-xs">
                    {selectedParcel.legalStatus}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-1">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Users className="h-3 w-3 text-blue-400" />
                    <span>R&R Status</span>
                  </div>
                  <div className="font-bold text-slate-200 text-xs">
                    {selectedParcel.rrStatus}
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Footer */}
            <div className="border-t border-slate-800 bg-slate-900/90 p-3 flex gap-2">
              <button
                onClick={() => {
                  const map = mapRef.current
                  if (!map || !geojsonData) return
                  const feature = geojsonData.features.find(
                    (f) => f.properties.parcelCode === selectedParcel.parcelCode
                  )
                  if (feature) {
                    const coords = feature.geometry.coordinates[0]
                    let sumLng = 0
                    let sumLat = 0
                    for (const [lng, lat] of coords) {
                      sumLng += lng
                      sumLat += lat
                    }
                    map.flyTo({
                      center: [sumLng / coords.length, sumLat / coords.length],
                      zoom: 17,
                      duration: 1000
                    })
                  }
                }}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <Compass className="h-3.5 w-3.5" />
                Zoom to Parcel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
