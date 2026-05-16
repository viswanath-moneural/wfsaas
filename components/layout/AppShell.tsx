'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import PermissionGate from '@/components/auth/PermissionGate'
import SuperadminViewBanner from '@/components/auth/SuperadminViewBanner'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import MobileNav from '@/components/layout/MobileNav'
import { useAuth } from '@/lib/AuthContext'

function moduleFromPath(pathname: string) {
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  if (!firstSegment || firstSegment === 'dashboard') return 'dashboard'
  if (['sales', 'purchases', 'manufacturing', 'inventory', 'crm', 'hr', 'reports', 'configuration'].includes(firstSegment)) {
    return firstSegment
  }
  return null
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user, permissions } = useAuth()
  const isSuperadmin = String(user?.role ?? '').toLowerCase() === 'superadmin'
    || String(permissions?.role_name ?? '').toLowerCase() === 'superadmin'
  const moduleKey = moduleFromPath(pathname)
  const gatedChildren = moduleKey ? <PermissionGate module={moduleKey}>{children}</PermissionGate> : children

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <TopBar />
        <SuperadminViewBanner />
        <div className="app-shell__content">{gatedChildren}</div>
      </div>
      <MobileNav />
      {isSuperadmin && (
        <Link className="superadmin-entry" href="/superadmin">
          Superadmin Console
        </Link>
      )}

      <style jsx>{`
        .app-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
          background: var(--surface-page);
        }

        .app-shell__main {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .app-shell__content {
          width: 100%;
          max-width: var(--page-max-width);
          margin: 0 auto;
          padding: var(--content-padding);
        }

        .superadmin-entry {
          position: fixed;
          left: 18px;
          bottom: 18px;
          z-index: 30;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          padding: 0 14px;
          border-radius: var(--radius-md);
          background: #0f172a;
          color: #fff;
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
          text-decoration: none;
          box-shadow: var(--shadow-modal);
        }

        .superadmin-entry:hover {
          background: #1e293b;
        }

        @media (max-width: 860px) {
          .app-shell {
            grid-template-columns: 1fr;
          }

          .app-shell__content {
            padding: var(--content-padding-mobile);
            padding-bottom: calc(var(--content-padding-mobile) + 72px);
          }

          .superadmin-entry {
            bottom: 84px;
          }
        }
      `}</style>
    </div>
  )
}




