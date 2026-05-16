'use client'

import { useAuth } from '@/lib/AuthContext'

export default function SuperadminViewBanner() {
  const { user, permissions, org, allOrganisations, switchOrgContext } = useAuth()
  const isSuperadmin = String(user?.role ?? '').toLowerCase() === 'superadmin'
    || String(permissions?.role_name ?? '').toLowerCase() === 'superadmin'

  if (!isSuperadmin) return null

  return (
    <div className="superadmin-view-banner">
      <span>You are viewing as Superadmin - all data across all organisations is visible</span>
      {allOrganisations.length > 0 && (
        <select value={org?.id ?? ''} onChange={(event) => switchOrgContext(event.target.value)} aria-label="Switch organisation context">
          {allOrganisations.map((organisation) => (
            <option key={organisation.id} value={organisation.id}>{organisation.name}</option>
          ))}
        </select>
      )}

      <style jsx>{`
        .superadmin-view-banner {
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          padding: var(--space-2) var(--content-padding);
          border-bottom: 1px solid #fde68a;
          background: #fef3c7;
          color: #78350f;
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }

        select {
          height: 30px;
          max-width: 280px;
          padding: 0 var(--space-2);
          border: 1px solid #f59e0b;
          border-radius: var(--radius-sm);
          background: #fff;
          color: #78350f;
          font-size: var(--text-sm);
        }

        @media (max-width: 720px) {
          .superadmin-view-banner {
            align-items: stretch;
            flex-direction: column;
            padding: var(--space-2) var(--content-padding-mobile);
          }

          select {
            max-width: none;
          }
        }
      `}</style>
    </div>
  )
}
