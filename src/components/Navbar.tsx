'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import {
  Landmark,
  BarChart3,
  ShieldCheck,
  ChevronDown,
  Building2,
  ClipboardList,
  FileBarChart2,
  CheckSquare,
  MapPin,
  Users,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRole, ROLE_CONFIGS, type DemoRole } from '@/context/RoleContext'

// ─────────────────────────────────────────────────────────────────────────────
// Role-aware navigation config
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
}

function getNavItems(role: DemoRole): NavItem[] {
  switch (role) {
    case 'CENTRAL':
      return [
        { href: '/dashboard', label: 'National Dashboard', icon: BarChart3 },
        { href: '/projects', label: 'All Projects', icon: Building2 },
        { href: '/mis', label: 'MIS Reports', icon: FileBarChart2 },
      ]
    case 'STATE':
      return [
        { href: '/dashboard', label: 'State Dashboard', icon: BarChart3 },
        { href: '/projects', label: 'Projects', icon: Building2 },
        { href: '/mis', label: 'MIS Reports', icon: FileBarChart2 },
      ]
    case 'DISTRICT':
      return [
        { href: '/dashboard', label: 'District Overview', icon: BarChart3 },
        { href: '/projects', label: 'Projects', icon: Building2 },
        { href: '/field-verification', label: 'Field Verification', icon: CheckSquare },
        { href: '/mis', label: 'Reports', icon: FileBarChart2 },
      ]
    case 'PROJECT_OFFICER':
      return [
        { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
        { href: '/projects', label: 'My Projects', icon: Building2 },
        { href: '/field-verification', label: 'Field Verification', icon: CheckSquare },
        { href: '/mis', label: 'Reports', icon: FileBarChart2 },
      ]
    case 'FIELD_OFFICER':
      return [
        { href: '/field-verification', label: 'Field Verification Tasks', icon: CheckSquare },
      ]
    default:
      return [
        { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
      ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Role Switcher Dropdown
// ─────────────────────────────────────────────────────────────────────────────

function RoleSwitcher() {
  const { activeRole, setActiveRole, roleConfig } = useRole()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (role: DemoRole) => {
    setActiveRole(role)
    setOpen(false)
    // Redirect to appropriate landing page for role
    if (role === 'FIELD_OFFICER') {
      router.push('/field-verification')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        id="demo-role-switcher"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-semibold shadow-xs transition-all',
          'hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1',
          roleConfig.bgColor,
          roleConfig.borderColor,
          roleConfig.color
        )}
      >
        {/* Role initials badge */}
        <span className={cn(
          'flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold bg-current/15 shrink-0',
        )}>
          {roleConfig.initials}
        </span>
        <span className="hidden sm:block max-w-[120px] truncate">
          {roleConfig.label}
        </span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Demo Role Switcher
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Prototype only — no authentication
            </p>
          </div>

          {/* Role options */}
          <ul className="py-1">
            {ROLE_CONFIGS.map(config => (
              <li key={config.role}>
                <button
                  role="option"
                  aria-selected={activeRole === config.role}
                  onClick={() => handleSelect(config.role)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    'hover:bg-slate-50 dark:hover:bg-slate-800',
                    activeRole === config.role && 'bg-slate-50 dark:bg-slate-800/60'
                  )}
                >
                  {/* Color indicator */}
                  <span className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold',
                    config.bgColor,
                    config.color,
                    config.borderColor,
                    'border'
                  )}>
                    {config.initials}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className={cn('text-xs font-semibold', config.color)}>
                      {config.label}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {config.description}
                    </div>
                  </div>

                  {activeRole === config.role && (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>

          {/* Footer disclaimer */}
          <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
            <p className="text-[9px] text-slate-400 dark:text-slate-500">
              ⚠ Prototype RBAC — role change takes immediate effect
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname()
  const { activeRole } = useRole()
  const navItems = getNavItems(activeRole)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand / Emblem */}
        <div className="flex items-center gap-4 min-w-0">
          <Link href={activeRole === 'FIELD_OFFICER' ? '/field-verification' : '/dashboard'} className="flex items-center gap-3 group shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-600 via-orange-500 to-emerald-600 p-0.5 shadow-sm shadow-orange-500/10 transition-transform group-hover:scale-105">
              <div className="flex h-full w-full items-center justify-center rounded-[7px] bg-slate-900 text-amber-400">
                <Landmark className="h-5 w-5" />
              </div>
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-slate-900 text-lg leading-tight dark:text-white">
                  BHŪMISETU
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60">
                  NATIONAL PLATFORM
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Real-Time Land Acquisition &amp; Management System
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200 dark:border-slate-800">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || (item.href === '/dashboard' && pathname === '/') || pathname.startsWith(item.href + '/')
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

        {/* Right: Role Switcher + Status */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="hidden lg:block">NIC Real-Time Data Grid</span>
          </div>

          {/* RBAC Demo Role Switcher */}
          <RoleSwitcher />

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="hidden sm:block">Govt. of India</span>
          </div>
        </div>
      </div>

      {/* Mobile nav strip */}
      {navItems.length > 0 && (
        <div className="md:hidden flex items-center gap-1 overflow-x-auto border-t border-slate-100 bg-white px-4 py-1.5 dark:border-slate-800 dark:bg-slate-950">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all whitespace-nowrap",
                  isActive
                    ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-400"
                )}
              >
                <Icon className="h-3 w-3" />
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </header>
  )
}
