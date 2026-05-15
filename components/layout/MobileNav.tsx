'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MODULE_REGISTRY, type ModuleKey } from '@/lib/modules'
import { useAuth } from '@/lib/AuthContext'
import { canAccessModule } from '@/lib/permissions'

const MOBILE_MODULES: ModuleKey[] = ['dashboard', 'sales', 'purchases', 'inventory', 'configuration']

export default function MobileNav() {
  const pathname = usePathname()
  const { permissions, isLoading } = useAuth()
  const items = MOBILE_MODULES
    .map((key) => MODULE_REGISTRY[key])
    .filter((moduleItem) => {
      if (isLoading || !permissions) return moduleItem.alwaysOn
      if (moduleItem.adminOnly && !permissions.is_admin) return false
      return moduleItem.alwaysOn || canAccessModule(permissions, moduleItem.key)
    })

  return (
    <>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link key={item.key} href={item.href} className={`nav-item ${active ? 'nav-item--active' : ''}`}>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <style jsx>{`
        .mobile-nav {
          display: none;
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: var(--z-popover);
          padding: 8px max(8px, env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
          background: var(--surface-card);
          border-top: 1px solid var(--border-default);
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 6px;
        }
        .nav-item {
          min-height: 36px;
          border-radius: var(--radius-md);
          display: grid;
          place-items: center;
          color: var(--text-secondary);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
          text-align: center;
        }
        .nav-item--active {
          background: var(--color-primary-50);
          color: var(--color-primary-700);
        }
        @media (max-width: 860px) {
          .mobile-nav {
            display: grid;
          }
        }
      `}</style>
    </>
  )
}
