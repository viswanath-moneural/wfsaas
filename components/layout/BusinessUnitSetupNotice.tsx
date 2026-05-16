'use client'

import Link from 'next/link'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'

interface BusinessUnitSetupNoticeProps {
  title: string
  description: string
}

export default function BusinessUnitSetupNotice({ title, description }: BusinessUnitSetupNoticeProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="notice">
        <p>Select a business unit to continue, or create one first.</p>
        <div className="actions">
          <Link href="/configuration/business-units"><Button>Go to Business Units</Button></Link>
          <Link href="/dashboard"><Button variant="outline">Select BusinessUnit</Button></Link>
        </div>
      </div>
      <style jsx>{`
        .notice {
          padding: var(--space-5);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--surface-card);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          max-width: 560px;
        }
        p { margin: 0; color: var(--text-secondary); }
        .actions { display: flex; gap: var(--space-3); flex-wrap: wrap; }
      `}</style>
    </>
  )
}




