import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}

      <style jsx>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        h1 {
          margin: 0;
          font-size: var(--text-3xl);
          line-height: var(--leading-tight);
          color: var(--text-primary);
        }

        p {
          margin: var(--space-2) 0 0;
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }

        .page-header__actions {
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}




