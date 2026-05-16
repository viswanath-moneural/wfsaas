'use client'

import Card from '@/components/Card'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/layout/PageHeader'

interface ComingSoonPageProps {
  title: string
  description?: string
}

export default function ComingSoonPage({
  title,
  description = 'This area is reserved in the product architecture and will be built in a later milestone.',
}: ComingSoonPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <div className="placeholder">
          <Badge variant="warning">Coming Soon</Badge>
          <h2>{title}</h2>
          <p>
            The route is available so users do not hit a 404, but the workflow is not enabled for MVP1 yet.
          </p>
        </div>
      </Card>
      <style jsx>{`
        .placeholder {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: var(--space-3);
        }

        h2 {
          margin: 0;
          font-size: var(--text-xl);
          color: var(--text-primary);
        }

        p {
          max-width: 640px;
          margin: 0;
          color: var(--text-secondary);
          line-height: var(--leading-normal);
        }
      `}</style>
    </>
  )
}
