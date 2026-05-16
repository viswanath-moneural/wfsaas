'use client'

import Link from 'next/link'
import Card from '@/components/Card'
import PageHeader from '@/components/layout/PageHeader'

const SALES_SECTIONS = [
  {
    title: 'Sales Orders',
    description: 'Create and track customer orders before dispatch and invoicing.',
    href: '/sales/orders',
  },
  {
    title: 'Invoices',
    description: 'Convert dispatches or orders into tax invoices.',
    href: '/sales/invoices',
  },
  {
    title: 'Payments',
    description: 'Record customer receipts and outstanding balances.',
    href: '/sales/payments',
  },
  {
    title: 'Dispatch',
    description: 'Prepare dispatch orders and delivery details.',
    href: '/sales/dispatch',
  },
]

export default function SalesPage() {
  return (
    <>
      <PageHeader
        title="Sales"
        description="Manage the order to cash flow for the active businessUnit."
      />

      <section className="sales-grid">
        {SALES_SECTIONS.map((section) => (
          <Link href={section.href} key={section.href}>
            <Card className="sales-card">
              <h2>{section.title}</h2>
              <p>{section.description}</p>
            </Card>
          </Link>
        ))}
      </section>

      <style jsx>{`
        .sales-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: var(--space-4);
        }

        .sales-card {
          min-height: 150px;
          transition: border-color var(--transition-fast), transform var(--transition-fast);
        }

        a:hover :global(.sales-card) {
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

        @media (max-width: 1000px) {
          .sales-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .sales-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}







