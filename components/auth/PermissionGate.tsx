'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { hasModuleAccess } from '@/lib/permissions'
import { useAuth } from '@/lib/AuthContext'

interface PermissionGateProps {
  module: string
  children: ReactNode
}

export default function PermissionGate({ module, children }: PermissionGateProps) {
  const router = useRouter()
  const { permissions, isLoading } = useAuth()

  if (isLoading) return null

  const canView = Boolean(permissions && hasModuleAccess(permissions, module, 'view'))
  if (canView) return <>{children}</>

  return (
    <div className="permission-denied">
      <div>
        <span>Access restricted</span>
        <h1>You don't have access to this module.</h1>
        <p>Contact your administrator to request access. Current role: <strong>{permissions?.role_name ?? 'Unknown'}</strong></p>
        <Button variant="outline" onClick={() => router.back()}>Back</Button>
      </div>

      <style jsx>{`
        .permission-denied {
          min-height: 55vh;
          display: grid;
          place-items: center;
          padding: var(--space-8);
        }

        .permission-denied div {
          width: min(560px, 100%);
          padding: var(--space-8);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--surface-card);
          box-shadow: var(--shadow-card);
        }

        span {
          color: var(--color-warning-700);
          font-size: var(--text-xs);
          font-weight: var(--font-bold);
          text-transform: uppercase;
        }

        h1 {
          margin: var(--space-2) 0;
          color: var(--text-primary);
          font-size: var(--text-2xl);
        }

        p {
          margin: 0 0 var(--space-5);
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }
      `}</style>
    </div>
  )
}
