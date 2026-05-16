'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MODULE_REGISTRY, SIDEBAR_MODULE_ORDER } from '@/lib/modules'
import Badge from '@/components/ui/Badge'
import { canAccessModule } from '@/lib/permissions'
import { useAuth } from '@/lib/AuthContext'

export default function Sidebar() {
  const pathname = usePathname()
  const { permissions, isLoading } = useAuth()

  const modules = SIDEBAR_MODULE_ORDER
    .map((key) => MODULE_REGISTRY[key])
    .filter((moduleItem) => {
      if (isLoading || !permissions) return moduleItem.alwaysOn
      if (moduleItem.adminOnly && !permissions.is_admin) return false
      return moduleItem.alwaysOn || canAccessModule(permissions, moduleItem.key)
    })

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__mark">WF</span>
        <div>
          <strong>WFSAAS</strong>
          <span>ERP workspace</span>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Main navigation">
        {modules.map((moduleItem) => {
          const active = pathname === moduleItem.href || pathname.startsWith(`${moduleItem.href}/`)
          if (moduleItem.comingSoon) {
            return (
              <div
                key={moduleItem.key}
                className={`sidebar__item sidebar__item--disabled ${active ? 'sidebar__item--active' : ''}`}
                aria-disabled="true"
              >
                <span className="sidebar__icon" style={{ background: moduleItem.color }} />
                <span>{moduleItem.label}</span>
                <Badge variant="warning">Soon</Badge>
              </div>
            )
          }
          return (
            <Link
              key={moduleItem.key}
              className={`sidebar__item ${active ? 'sidebar__item--active' : ''}`}
              href={moduleItem.href}
            >
              <span className="sidebar__icon" style={{ background: moduleItem.color }} />
              <span>{moduleItem.label}</span>
            </Link>
          )
        })}
      </nav>

      <style jsx>{`
        .sidebar {
          min-height: 100vh;
          padding: var(--space-4);
          background: var(--surface-sidebar);
          color: var(--text-on-nav);
        }

        .sidebar__brand {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-2) var(--space-2) var(--space-6);
          color: var(--text-inverse);
        }

        .sidebar__mark {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: var(--radius-lg);
          background: var(--color-primary-600);
          font-weight: var(--font-bold);
        }

        .sidebar__brand strong,
        .sidebar__brand span {
          display: block;
        }

        .sidebar__brand strong {
          font-size: var(--text-sm);
        }

        .sidebar__brand div span {
          margin-top: var(--space-0-5);
          font-size: var(--text-xs);
          color: var(--text-on-nav);
        }

        .sidebar__nav {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .sidebar__item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          min-height: var(--sidebar-item-height);
          padding: 0 var(--sidebar-item-px);
          border-radius: var(--sidebar-item-radius);
          color: var(--text-on-nav);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }

        .sidebar__item :global(.badge) {
          margin-left: auto;
        }

        .sidebar__item:hover {
          background: var(--surface-sidebar-hover);
          color: var(--text-on-nav-active);
        }

        .sidebar__item--active {
          background: var(--surface-sidebar-active);
          color: var(--text-on-nav-active);
        }

        .sidebar__item--disabled {
          cursor: default;
          opacity: 0.72;
        }

        .sidebar__item--disabled:hover {
          background: transparent;
          color: var(--text-on-nav);
        }

        .sidebar__icon {
          width: 8px;
          height: 8px;
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }

        @media (max-width: 860px) {
          .sidebar {
            display: none;
          }
        }
      `}</style>
    </aside>
  )
}
