'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

const sections = [
  {
    label: 'Users & Access',
    items: [
      { label: 'Users', href: '/administration/users' },
      { label: 'Profiles', href: '/administration/profiles' },
      { label: 'Roles', href: '/administration/roles' },
      { label: 'Permission Sets', href: '/administration/permission-sets' },
    ],
  },
  {
    label: 'Company Settings',
    items: [
      { label: 'Organisation', href: '/administration/organisation' },
      { label: 'Business Units', href: '/administration/business-units' },
    ],
  },
  {
    label: 'Automation',
    items: [
      { label: 'Number Series', href: '/administration/number-series' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { label: 'Audit Log', href: '/administration/audit-log' },
    ],
  },
]

interface AdministrationShellProps {
  children: ReactNode
  user: {
    name: string
    email: string
    role: string
  }
}

export default function AdministrationShell({ children, user }: AdministrationShellProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const nav = (
    <>
      <div className="admin-nav__header">
        <strong>Administration</strong>
        <span>Setup workspace</span>
      </div>

      <nav aria-label="Administration setup navigation">
        {sections.map((section) => (
          <div key={section.label} className="admin-nav__section">
            <h2>{section.label}</h2>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  className={active ? 'active' : ''}
                  href={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="admin-nav__user">
        <span>{user.name}</span>
        <small>{user.email}</small>
        <Badge variant="slate">{user.role}</Badge>
      </div>
    </>
  )

  return (
    <div className="admin-layout">
      <div className="admin-mobile-bar">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Setup Menu</Button>
        <strong>Administration</strong>
      </div>

      <aside className="admin-nav admin-nav--desktop">{nav}</aside>

      {open && (
        <div className="admin-drawer" role="dialog" aria-modal="true" aria-label="Administration navigation">
          <button className="admin-drawer__backdrop" onClick={() => setOpen(false)} aria-label="Close administration menu" />
          <aside className="admin-nav admin-nav--drawer">{nav}</aside>
        </div>
      )}

      <main className="admin-content">{children}</main>

      <style jsx>{`
        .admin-layout {
          min-height: calc(100vh - var(--topbar-height));
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: var(--space-6);
        }

        .admin-nav {
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - var(--topbar-height) - (var(--content-padding) * 2));
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--surface-card);
          overflow: hidden;
        }

        .admin-nav--desktop {
          position: sticky;
          top: var(--space-4);
          align-self: start;
        }

        .admin-nav__header {
          display: grid;
          gap: var(--space-1);
          padding: var(--space-4);
          border-bottom: 1px solid var(--border-default);
        }

        .admin-nav__header strong {
          color: var(--text-primary);
          font-size: var(--text-md);
        }

        .admin-nav__header span,
        .admin-nav__user small {
          color: var(--text-secondary);
          font-size: var(--text-xs);
        }

        nav {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-3);
        }

        .admin-nav__section + .admin-nav__section {
          margin-top: var(--space-4);
        }

        h2 {
          margin: 0 0 var(--space-2);
          color: var(--text-tertiary);
          font-size: 11px;
          font-weight: var(--font-bold);
          letter-spacing: 0;
          text-transform: uppercase;
        }

        a {
          display: flex;
          align-items: center;
          min-height: 36px;
          padding: 0 var(--space-3);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          text-decoration: none;
        }

        a:hover {
          background: var(--color-gray-50);
          color: var(--text-primary);
        }

        a.active {
          background: var(--color-primary-50);
          color: var(--color-primary-700);
          box-shadow: inset 3px 0 0 var(--color-primary-600);
        }

        .admin-nav__user {
          display: grid;
          gap: var(--space-1);
          padding: var(--space-4);
          border-top: 1px solid var(--border-default);
        }

        .admin-nav__user span {
          color: var(--text-primary);
          font-size: var(--text-sm);
          font-weight: var(--font-semibold);
        }

        .admin-content {
          min-width: 0;
          overflow: auto;
        }

        .admin-mobile-bar {
          display: none;
        }

        .admin-drawer {
          position: fixed;
          inset: 0;
          z-index: 80;
        }

        .admin-drawer__backdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(15, 23, 42, 0.45);
        }

        .admin-nav--drawer {
          position: absolute;
          inset: 0 auto 0 0;
          width: min(320px, 88vw);
          min-height: 100vh;
          border-radius: 0;
          border: 0;
        }

        @media (max-width: 920px) {
          .admin-layout {
            grid-template-columns: 1fr;
            gap: var(--space-4);
          }

          .admin-nav--desktop {
            display: none;
          }

          .admin-mobile-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-3);
            padding: var(--space-3);
            border: 1px solid var(--border-default);
            border-radius: var(--radius-md);
            background: var(--surface-card);
          }
        }
      `}</style>
    </div>
  )
}








