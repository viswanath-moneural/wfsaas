'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const sections = [
  {
    label: 'Platform',
    items: [
      { label: 'Dashboard', href: '/superadmin' },
      { label: 'Organisations', href: '/superadmin/organisations' },
      { label: 'Business Units', href: '/superadmin/business-units' },
    ],
  },
  {
    label: 'User Management',
    items: [
      { label: 'Users', href: '/superadmin/users' },
      { label: 'Roles & Permissions', href: '/superadmin/roles' },
      { label: 'User Sessions', href: '/superadmin/sessions' },
    ],
  },
  {
    label: 'App Configuration',
    items: [
      { label: 'Modules', href: '/superadmin/modules' },
      { label: 'Number Series', href: '/superadmin/number-series' },
      { label: 'Custom Fields', href: '/superadmin/custom-fields' },
    ],
  },
  {
    label: 'Data',
    items: [
      { label: 'All Records', href: '/superadmin/data' },
      { label: 'Audit Log', href: '/superadmin/audit-log' },
      { label: 'Data Export', href: '/superadmin/export' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', href: '/superadmin/settings' },
      { label: 'Health Check', href: '/superadmin/health' },
    ],
  },
]

export default function SuperadminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="super-sidebar">
      <div className="super-sidebar__brand">
        <span>WF</span>
        <div>
          <strong>Superadmin</strong>
          <small>Platform setup</small>
        </div>
      </div>

      <nav aria-label="Superadmin navigation">
        {sections.map((section) => (
          <div key={section.label} className="super-sidebar__section">
            <h2>{section.label}</h2>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link key={item.href} className={active ? 'active' : ''} href={item.href}>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <style jsx>{`
        .super-sidebar {
          min-height: 100vh;
          padding: 20px 16px;
          background: #0f172a;
          color: #cbd5e1;
        }

        .super-sidebar__brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 8px 24px;
          color: #fff;
        }

        .super-sidebar__brand span {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: #0f766e;
          font-weight: 800;
        }

        .super-sidebar__brand strong,
        .super-sidebar__brand small {
          display: block;
        }

        .super-sidebar__brand small {
          margin-top: 2px;
          color: #94a3b8;
        }

        nav {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .super-sidebar__section h2 {
          margin: 0 0 8px;
          padding: 0 8px;
          color: #64748b;
          font-size: 11px;
          line-height: 1.2;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        a {
          display: flex;
          align-items: center;
          min-height: 36px;
          padding: 0 10px;
          border-radius: 8px;
          color: #cbd5e1;
          font-size: 14px;
          text-decoration: none;
        }

        a:hover {
          background: #1e293b;
          color: #fff;
        }

        a.active {
          background: #334155;
          color: #fff;
          box-shadow: inset 3px 0 0 #14b8a6;
        }
      `}</style>
    </aside>
  )
}








