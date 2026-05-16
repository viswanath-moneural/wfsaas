'use client'

import Link from 'next/link'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/AuthContext'

export default function TopBar() {
  const { user, org, businessUnit, businessUnits, switchBusinessUnit, signOut, isLoading, permissions } = useAuth()
  const showBusinessUnitCta = !businessUnit && (permissions?.is_admin ?? false)

  async function handleSignOut() {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <header className="topbar">
      <div className="topbar__context">
        <span>{isLoading ? 'Loading workspace' : org?.name ?? 'Workspace'}</span>
        <strong>{businessUnit?.name ?? 'No active business unit'}</strong>
      </div>

      <div className="topbar__actions">
        {businessUnits.length >= 1 && (
          <select
            value={businessUnit?.id ?? ''}
            onChange={(event) => switchBusinessUnit(event.target.value)}
            aria-label="Switch business unit"
          >
            {!businessUnit && <option value="" disabled>Select business unit</option>}
            {businessUnits.map((businessUnitItem) => (
              <option key={businessUnitItem.id} value={businessUnitItem.id}>
                {businessUnitItem.name}
              </option>
            ))}
          </select>
        )}
        {showBusinessUnitCta && businessUnits.length === 0 && (
          <Link href="/configuration/business-units">
            <Button size="sm">Create first business unit</Button>
          </Link>
        )}
        <span className="topbar__user">{user?.full_name ?? user?.email ?? ''}</span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>

      <style jsx>{`
        .topbar {
          min-height: var(--topbar-height);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          padding: 0 var(--content-padding);
          background: var(--surface-topbar);
          border-bottom: 1px solid var(--border-default);
        }

        .topbar__context {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-0-5);
        }

        .topbar__context span {
          color: var(--text-secondary);
          font-size: var(--text-xs);
        }

        .topbar__context strong {
          color: var(--text-primary);
          font-size: var(--text-sm);
        }

        .topbar__actions {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        select {
          height: var(--input-height-md);
          padding: 0 var(--space-3);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--surface-input);
          color: var(--text-primary);
          font-size: var(--text-sm);
        }

        .topbar__user {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }

        @media (max-width: 640px) {
          .topbar {
            padding: 0 var(--content-padding-mobile);
          }

          .topbar__user,
          select {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}






