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
}

export function usePermissions(moduleKey: ModuleKey | string): PermissionState {
  const { permissions } = useAuth()

  return useMemo(() => {
    const can = (action: Action) => Boolean(permissions && hasModuleAccess(permissions, moduleKey, action))
    const canEdit = can('update')

    return {
      canCreate: can('create'),
      canEdit,
      canDelete: can('delete'),
      canView: can('read'),
      canUpdate: canEdit,
    }
  }, [moduleKey, permissions])
}
