/**
 * Prototype RBAC helpers for BhūmiSetu.
 * 
 * This is NOT production authentication.
 * The role is passed via the x-demo-role HTTP header.
 * Backend checks validate that the role is allowed to perform an action.
 */

import { NextRequest, NextResponse } from 'next/server'

export type DemoRole =
  | 'CENTRAL'
  | 'STATE'
  | 'DISTRICT'
  | 'PROJECT_OFFICER'
  | 'FIELD_OFFICER'

export const VALID_ROLES: DemoRole[] = [
  'CENTRAL',
  'STATE',
  'DISTRICT',
  'PROJECT_OFFICER',
  'FIELD_OFFICER',
]

// ─────────────────────────────────────────────────────────────────────────────
// Permission definitions
// ─────────────────────────────────────────────────────────────────────────────

export type PermissionAction =
  | 'view:national_dashboard'
  | 'view:state_dashboard'
  | 'view:district_dashboard'
  | 'view:all_projects'
  | 'view:project_detail'
  | 'view:parcels'
  | 'view:compensation'
  | 'view:rr'
  | 'view:mis_reports'
  | 'view:field_verification'
  | 'submit:field_verification'
  | 'update:task'
  | 'generate:report'
  | 'export:report'

const ROLE_PERMISSIONS: Record<DemoRole, PermissionAction[]> = {
  CENTRAL: [
    'view:national_dashboard',
    'view:state_dashboard',
    'view:district_dashboard',
    'view:all_projects',
    'view:project_detail',
    'view:parcels',
    'view:compensation',
    'view:rr',
    'view:mis_reports',
    'view:field_verification',
    'update:task',
    'generate:report',
    'export:report',
  ],
  STATE: [
    'view:state_dashboard',
    'view:district_dashboard',
    'view:all_projects',
    'view:project_detail',
    'view:parcels',
    'view:compensation',
    'view:rr',
    'view:mis_reports',
    'view:field_verification',
    'update:task',
    'generate:report',
    'export:report',
  ],
  DISTRICT: [
    'view:district_dashboard',
    'view:all_projects',
    'view:project_detail',
    'view:parcels',
    'view:compensation',
    'view:rr',
    'view:mis_reports',
    'view:field_verification',
    'submit:field_verification',
    'update:task',
    'generate:report',
    'export:report',
  ],
  PROJECT_OFFICER: [
    'view:project_detail',
    'view:all_projects',
    'view:parcels',
    'view:compensation',
    'view:rr',
    'view:mis_reports',
    'view:field_verification',
    'submit:field_verification',
    'update:task',
    'generate:report',
    'export:report',
  ],
  FIELD_OFFICER: [
    'view:field_verification',
    'submit:field_verification',
    'view:parcels',
    'update:task',
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function canAccess(role: DemoRole, action: PermissionAction): boolean {
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  return perms.includes(action)
}

export function getRoleFromHeader(request: NextRequest): DemoRole | null {
  const header = request.headers.get('x-demo-role')
  if (!header) return null
  if (VALID_ROLES.includes(header as DemoRole)) return header as DemoRole
  return null
}

/**
 * Check that the request's x-demo-role header is one of the allowed roles
 * and has the required permission. Returns a 403 response if not.
 */
export function checkRolePermission(
  request: NextRequest,
  action: PermissionAction
): NextResponse | null {
  const role = getRoleFromHeader(request)

  if (!role) {
    return NextResponse.json(
      { error: 'Demo role header missing. Set x-demo-role header.' },
      { status: 401 }
    )
  }

  if (!canAccess(role, action)) {
    return NextResponse.json(
      {
        error: `Role '${role}' is not permitted to perform '${action}'.`,
        role,
        action,
      },
      { status: 403 }
    )
  }

  return null // Allowed
}
