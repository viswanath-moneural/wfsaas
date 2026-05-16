'use client'

import Link from 'next/link'
import Card from '@/components/Card'
import PageHeader from '@/components/layout/PageHeader'

const SECTIONS = [
  { title: 'Purchase Orders', description: 'Create and approve purchase orders.', href: '/purchases/orders' },
  { title: 'GRN', description: 'Receive materials against purchase orders.', href: '/purchases/grn' },
  { title: 'Vendor Payments', description: 'Record outgoing payments.', href: '/purchases/payments' },
]

export default function PurchasesPage() {
  return (
    <>
      <PageHeader title="Purchases" description="Manage procure-to-pay for the active businessUnit." />
      <section className="grid">
        {SECTIONS.map((section) => (
          <Link href={section.href} key={section.href}>
            <Card className="card">
              <h2>{section.title}</h2>
              <p>{section.description}</p>
            </Card>
          </Link>
        ))}
      </section>
      <style jsx>{`
        .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
        .card { min-height: 140px; }
        h2 { margin: 0; font-size: var(--text-lg); }
        p { margin: var(--space-2) 0 0; color: var(--text-secondary); font-size: var(--text-sm); }
        @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </>
  )
}







