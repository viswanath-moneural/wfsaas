'use client'

import { useMemo } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { hasModuleAccess, type Action } from '@/lib/permissions'
import type { ModuleKey } from '@/lib/modules'

export interface PermissionState {
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canView: boolean
  canUpdate: boolean
  canExport: boolean
  canApprove: boolean
}

export function usePermissions(moduleKey: ModuleKey | string): PermissionState {
  const { permissions } = useAuth()

  return useMemo(() => {
    const can = (action: Action) => Boolean(permissions && hasModuleAccess(permissions, moduleKey, action))
    const modulePermission = permissions?.module_permissions?.[moduleKey]
    const canEdit = can('update')

    return {
      canCreate: can('create'),
      canEdit,
      canDelete: can('delete'),
      canView: can('read'),
      canUpdate: canEdit,
      canExport: Boolean(permissions?.is_admin || modulePermission?.can_export || modulePermission?.canExport),
      canApprove: Boolean(permissions?.is_admin || modulePermission?.can_approve || modulePermission?.canApprove),
    }
  }, [moduleKey, permissions])
}
