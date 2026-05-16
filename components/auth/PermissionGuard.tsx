'use client'

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { hasModuleAccess, type Action } from '@/lib/permissions'
import { useAuth } from '@/lib/AuthContext'

type GuardAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export'

interface PermissionGuardProps {
  module: string
  action: GuardAction
  children: ReactNode
  fallback?: ReactNode
  mode?: 'disabled' | 'hidden'
}

function normalizeAction(action: GuardAction): Action {
  if (action === 'view') return 'view'
  if (action === 'edit') return 'edit'
  return action
}

export default function PermissionGuard({
  module,
  action,
  children,
  fallback = null,
  mode = 'disabled',
}: PermissionGuardProps) {
  const { permissions, isLoading } = useAuth()
  if (isLoading) return null

  const allowed = Boolean(permissions && hasModuleAccess(permissions, module, normalizeAction(action)))
  if (allowed) return <>{children}</>
  if (mode === 'hidden') return <>{fallback}</>

  if (isValidElement(children)) {
    return cloneElement(children as ReactElement<any>, {
      disabled: true,
      title: `You do not have ${action} permission for ${module}.`,
      'aria-disabled': true,
    })
  }

  return <>{fallback}</>
}




