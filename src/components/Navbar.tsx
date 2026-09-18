'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Landmark, Layers, BarChart3, ShieldCheck, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navbar() {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'National Dashboard', icon: BarChart3 },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand / Emblem */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-600 via-orange-500 to-emerald-600 p-0.5 shadow-sm shadow-orange-500/10 transition-transform group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[7px] bg-slate-900 text-amber-400">
                <Landmark className="h-5 w-5" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-slate-900 text-lg leading-tight dark:text-white">
                  BHŪMISETU
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60">
                  NATIONAL PLATFORM
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Real-Time Land Acquisition & Management System
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200 dark:border-slate-800">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href === '/dashboard' && pathname === '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold tracking-wide transition-all",
                    isActive
                      ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: Network Status & Metadata */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>NIC Real-Time Data Grid</span>
          </div>
          
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Govt. of India</span>
          </div>
        </div>
      </div>
    </header>
  )
}
