'use client'

import Link from 'next/link'
import Card from '@/components/Card'
import PageHeader from '@/components/layout/PageHeader'

const SECTIONS = [
  { title: 'Employees', description: 'Maintain employee master records.', href: '/hr/employees' },
  { title: 'Attendance', description: 'Track daily attendance and shifts.', href: '/hr/attendance' },
  { title: 'Payroll', description: 'Run payroll cycles and payouts.', href: '/hr/payroll' },
]

export default function HrPage() {
  return (
    <>
      <PageHeader title="HR" description="Manage workforce records, attendance, and payroll." />
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
        .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
        .card { min-height: 140px; }
        h2 { margin: 0; font-size: var(--text-lg); }
        p { margin: var(--space-2) 0 0; color: var(--text-secondary); font-size: var(--text-sm); }
        @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </>
  )
}
