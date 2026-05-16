'use client'

import { useMemo } from 'react'
import { usePermissions as useAuthPermissions } from '@/lib/auth/usePermissions'
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
  const authPermissions = useAuthPermissions(String(moduleKey))

  return useMemo(() => {
    const legacyPermissions = null as any
    const can = (action: Action) => Boolean(legacyPermissions && hasModuleAccess(legacyPermissions, moduleKey, action))
    const canEdit = authPermissions.canEdit || can('update')

    return {
      canCreate: authPermissions.canCreate || can('create'),
      canEdit,
      canDelete: authPermissions.canDelete || can('delete'),
      canView: authPermissions.canView || can('read'),
      canUpdate: canEdit,
      canExport: authPermissions.canExport,
      canApprove: authPermissions.canApprove,
    }
  }, [authPermissions, moduleKey])
}
