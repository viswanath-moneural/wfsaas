'use client'

import Link from 'next/link'
import Card from '@/components/Card'
import PageHeader from '@/components/layout/PageHeader'

const CONFIG_SECTIONS = [
  {
    title: 'Factories',
    description: 'Manage branches, plants, and tenant-level operating units.',
    href: '/configuration/tenants',
  },
  {
    title: 'Products',
    description: 'Create finished goods used by sales, inventory, and production.',
    href: '/configuration/products',
  },
  {
    title: 'Materials',
    description: 'Raw material masters for purchases and inventory.',
    href: '/configuration/materials',
  },
  {
    title: 'Customers',
    description: 'Customer masters for sales orders, invoices, and payments.',
    href: '/configuration/customers',
  },
  {
    title: 'Vendors',
    description: 'Supplier masters for purchase orders, GRNs, and payments.',
    href: '/configuration/vendors',
  },
  {
    title: 'Warehouses',
    description: 'Stock locations used by movements, adjustments, and balances.',
    href: '/configuration/warehouses',
  },
  {
    title: 'Users & Roles',
    description: 'Invite users and control module permissions.',
    href: '/configuration/users',
  },
  {
    title: 'Modules',
    description: 'Turn ERP modules on or off for the organisation.',
    href: '/configuration/modules',
  },
  {
    title: 'Number Series',
    description: 'Configure document codes for orders, invoices, GRNs, and more.',
    href: '/configuration/number-series',
  },
]

export default function ConfigurationPage() {
  return (
    <>
      <PageHeader
        title="Configuration"
        description="Set up the organisation, factories, permissions, and core masters before transactions."
      />

      <section className="config-grid">
        {CONFIG_SECTIONS.map((section) => (
          <Link href={section.href} key={section.href}>
            <Card className="config-card">
              <h2>{section.title}</h2>
              <p>{section.description}</p>
            </Card>
          </Link>
        ))}
      </section>

      <style jsx>{`
        .config-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: var(--space-4);
        }

        .config-card {
          min-height: 150px;
          transition: border-color var(--transition-fast), transform var(--transition-fast);
        }

        a:hover :global(.config-card) {
          border-color: var(--color-primary-600);
          transform: translateY(-1px);
        }

        h2 {
          margin: 0;
          color: var(--text-primary);
          font-size: var(--text-lg);
        }

        p {
          margin: var(--space-2) 0 0;
          color: var(--text-secondary);
          font-size: var(--text-sm);
          line-height: var(--leading-normal);
        }

        @media (max-width: 960px) {
          .config-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .config-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}
