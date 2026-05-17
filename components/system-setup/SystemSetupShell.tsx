'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Badge from '@/components/ui/Badge'

const navItems = [
  { href: '/system-setup/elements', label: 'Element Manager', icon: 'EM' },
  { href: '/system-setup/layouts', label: 'Screen Designer', icon: 'SD' },
  { href: '/system-setup/actors', label: 'Actors', icon: 'AC' },
  { href: '/system-setup/actor-roles', label: 'Actor Roles', icon: 'AR' },
  { href: '/system-setup/add-on-permissions', label: 'Add-on Permissions', icon: 'AP' },
  { href: '/system-setup/org-tree', label: 'Org Tree', icon: 'OT' },
  { href: '/system-setup/action-log', label: 'Action Log', icon: 'AL' },
  { href: '/system-setup/modules', label: 'Module Manager', icon: 'MM' },
]

export default function SystemSetupShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: { name: string; email: string; role: string; orgName: string; businessUnitName: string }
}) {
  const pathname = usePathname()

  return (
    <div className="system-setup-shell">
      <aside>
        <div className="setup-brand">
          <strong>System Setup</strong>
          <span>Administration workspace</span>
        </div>
        <nav aria-label="System Setup navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="setup-context">
          <span>{user.orgName}</span>
          <small>{user.businessUnitName}</small>
          <Badge variant="slate">{user.role}</Badge>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span>Managing</span>
            <strong>{user.orgName}</strong>
            <small>{user.businessUnitName}</small>
          </div>
          <div className="setup-user">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
        </header>
        {children}
      </main>
      <style jsx>{`
        .system-setup-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          background: var(--surface-page);
        }
        aside {
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-default);
          background: var(--surface-card);
        }
        .setup-brand {
          display: grid;
          gap: var(--space-1);
          padding: var(--space-5);
          border-bottom: 1px solid var(--border-default);
        }
        .setup-brand strong {
          font-size: var(--text-lg);
        }
        .setup-brand span,
        .setup-context small,
        header span,
        header small,
        .setup-user small {
          color: var(--text-secondary);
          font-size: var(--text-xs);
        }
        nav {
          flex: 1;
          padding: var(--space-3);
        }
        nav a {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          min-height: 40px;
          padding: 0 var(--space-3);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          text-decoration: none;
        }
        nav a span {
          display: inline-grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-sm);
          background: var(--color-gray-100);
          color: var(--text-tertiary);
          font-size: 10px;
          font-weight: var(--font-bold);
        }
        nav a.active,
        nav a:hover {
          background: var(--color-primary-50);
          color: var(--color-primary-700);
        }
        .setup-context {
          display: grid;
          gap: var(--space-1);
          padding: var(--space-4);
          border-top: 1px solid var(--border-default);
        }
        .setup-context span {
          font-weight: var(--font-semibold);
        }
        main {
          min-width: 0;
          padding: var(--space-6);
        }
        header {
          display: flex;
          justify-content: space-between;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--border-default);
        }
        header > div {
          display: grid;
          gap: var(--space-1);
        }
        .setup-user {
          text-align: right;
        }
        @media (max-width: 860px) {
          .system-setup-shell {
            grid-template-columns: 1fr;
          }
          aside {
            position: static;
            height: auto;
          }
          nav {
            display: flex;
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  )
}
