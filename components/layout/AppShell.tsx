'use client'

import type { ReactNode } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import MobileNav from '@/components/layout/MobileNav'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <TopBar />
        <div className="app-shell__content">{children}</div>
      </div>
      <MobileNav />

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

        @media (max-width: 860px) {
          .app-shell {
            grid-template-columns: 1fr;
          }

          .app-shell__content {
            padding: var(--content-padding-mobile);
            padding-bottom: calc(var(--content-padding-mobile) + 72px);
          }
        }
      `}</style>
    </div>
  )
}
