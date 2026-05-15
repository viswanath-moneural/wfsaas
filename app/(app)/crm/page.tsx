'use client'

import Link from 'next/link'
import Card from '@/components/Card'
import PageHeader from '@/components/layout/PageHeader'

const SECTIONS = [
  { title: 'Leads', description: 'Capture and track inbound prospects.', href: '/crm/leads' },
  { title: 'Opportunities', description: 'Manage deal stages and expected value.', href: '/crm/opportunities' },
  { title: 'Quotes', description: 'Prepare and share customer quotations.', href: '/crm/quotes' },
  { title: 'Interactions', description: 'Log calls, meetings, and follow-ups.', href: '/crm/interactions' },
]

export default function CrmPage() {
  return (
    <>
      <PageHeader title="CRM" description="Manage lead-to-quote customer lifecycle." />
      <section className="grid">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="card">
              <h2>{section.title}</h2>
              <p>{section.description}</p>
            </Card>
          </Link>
        ))}
      </section>
      <style jsx>{`
        .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); }
        .card { min-height: 140px; }
        h2 { margin: 0; font-size: var(--text-lg); }
        p { margin: var(--space-2) 0 0; color: var(--text-secondary); font-size: var(--text-sm); }
        @media (max-width: 1000px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </>
  )
}
