'use client'

import { useMemo } from 'react'
import { useAuth } from '@/lib/AuthContext'

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'approve'

export interface ModulePermissionState {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canExport: boolean
  canApprove: boolean
}

export function usePermissions(moduleKey?: string): ModulePermissionState & {
  permissions: Record<string, ModulePermissionState>
  can: (module: string, action: PermissionAction) => boolean
  profileName: string
  roleName: string
} {
  const { permissions } = useAuth()

  return useMemo(() => {
    const map = (permissions?.permissions_map ?? permissions?.module_permissions ?? {}) as Record<string, any>
    const isAdmin = Boolean(permissions?.is_admin)

    const normalize = (module: string): ModulePermissionState => {
      const row = map[module] ?? {}
      return {
        canView: isAdmin || Boolean(row.canView ?? row.can_view ?? row.can_read),
        canCreate: isAdmin || Boolean(row.canCreate ?? row.can_create),
        canEdit: isAdmin || Boolean(row.canEdit ?? row.can_edit ?? row.can_update),
        canDelete: isAdmin || Boolean(row.canDelete ?? row.can_delete),
        canExport: isAdmin || Boolean(row.canExport ?? row.can_export),
        canApprove: isAdmin || Boolean(row.canApprove ?? row.can_approve),
      }
    }

    const normalizedMap = Object.fromEntries(Object.keys(map).map((key) => [key, normalize(key)]))
    const current = moduleKey ? normalize(moduleKey) : normalize('')
    const can = (module: string, action: PermissionAction) => {
      const row = normalize(module)
      if (action === 'view') return row.canView
      if (action === 'create') return row.canCreate
      if (action === 'edit') return row.canEdit
      if (action === 'delete') return row.canDelete
      if (action === 'export') return row.canExport
      return row.canApprove
    }

    return {
      ...current,
      permissions: normalizedMap,
      can,
      profileName: permissions?.profile_name ?? '',
      roleName: permissions?.role_name ?? '',
    }
  }, [moduleKey, permissions])
}
