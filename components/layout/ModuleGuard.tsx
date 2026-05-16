'use client'

import type { ReactNode } from 'react'
import { hasModuleAccess, type Action } from '@/lib/permissions'
import { useAuth } from '@/lib/AuthContext'

interface ModuleGuardProps {
  moduleKey: string
  action?: Action
  children: ReactNode
  fallback?: ReactNode
}

export default function ModuleGuard({
  moduleKey,
  action = 'read',
  children,
  fallback = null,
}: ModuleGuardProps) {
  const { permissions, isLoading } = useAuth()

  if (isLoading) return null
  if (!permissions || !hasModuleAccess(permissions, moduleKey, action)) return <>{fallback}</>

  return <>{children}</>
}




