'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DemoRole =
  | 'CENTRAL'
  | 'STATE'
  | 'DISTRICT'
  | 'PROJECT_OFFICER'
  | 'FIELD_OFFICER'

export interface RoleConfig {
  role: DemoRole
  label: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  initials: string
}

export const ROLE_CONFIGS: RoleConfig[] = [
  {
    role: 'CENTRAL',
    label: 'Central Authority',
    description: 'National-level access — all projects, states, MIS',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-950/50',
    borderColor: 'border-blue-200 dark:border-blue-800',
    initials: 'CA',
  },
  {
    role: 'STATE',
    label: 'State Authority',
    description: 'State-level access — state projects, reports, R&R',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/50',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    initials: 'SA',
  },
  {
    role: 'DISTRICT',
    label: 'District Authority',
    description: 'District-level — parcels, compensation, field tasks',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-950/50',
    borderColor: 'border-amber-200 dark:border-amber-800',
    initials: 'DA',
  },
  {
    role: 'PROJECT_OFFICER',
    label: 'Project Officer',
    description: 'Project-level — land, compensation, R&R, reports',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-50 dark:bg-purple-950/50',
    borderColor: 'border-purple-200 dark:border-purple-800',
    initials: 'PO',
  },
  {
    role: 'FIELD_OFFICER',
    label: 'Field Officer',
    description: 'Field verification only — tasks and parcel checks',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-50 dark:bg-orange-950/50',
    borderColor: 'border-orange-200 dark:border-orange-800',
    initials: 'FO',
  },
]

export function getRoleConfig(role: DemoRole): RoleConfig {
  return ROLE_CONFIGS.find(r => r.role === role) ?? ROLE_CONFIGS[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bhoomisetu_demo_role'

interface RoleContextValue {
  activeRole: DemoRole
  setActiveRole: (role: DemoRole) => void
  roleConfig: RoleConfig
}

const RoleContext = createContext<RoleContextValue>({
  activeRole: 'CENTRAL',
  setActiveRole: () => {},
  roleConfig: ROLE_CONFIGS[0],
})

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [activeRole, setActiveRoleState] = useState<DemoRole>('CENTRAL')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Hydrate from localStorage on mount
    const stored = localStorage.getItem(STORAGE_KEY) as DemoRole | null
    if (stored && ROLE_CONFIGS.some(r => r.role === stored)) {
      setActiveRoleState(stored)
    }
    setMounted(true)
  }, [])

  const setActiveRole = (role: DemoRole) => {
    setActiveRoleState(role)
    localStorage.setItem(STORAGE_KEY, role)
  }

  const roleConfig = getRoleConfig(activeRole)

  // Prevent SSR/client mismatch by suppressing render until mounted
  if (!mounted) {
    return (
      <RoleContext.Provider value={{ activeRole: 'CENTRAL', setActiveRole, roleConfig: ROLE_CONFIGS[0] }}>
        {children}
      </RoleContext.Provider>
    )
  }

  return (
    <RoleContext.Provider value={{ activeRole, setActiveRole, roleConfig }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole(): RoleContextValue {
  return useContext(RoleContext)
}
