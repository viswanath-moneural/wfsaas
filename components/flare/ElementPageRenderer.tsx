'use client'

import Card from '@/components/Card'

export default function ElementPageRenderer({
  elementLabel,
  sections,
}: {
  elementLabel: string
  sections: Array<{ id: string; title: string; fields: Array<{ id: string; label: string; required?: boolean; readOnly?: boolean }> }>
}) {
  return (
    <Card>
      <h2>{elementLabel} Element Page</h2>
      <div className="sections">
        {sections.map((section) => (
          <section key={section.id}>
            <h3>{section.title}</h3>
            <div className="fields">
              {section.fields.map((field) => (
                <label key={field.id}>
                  <span>{field.label}{field.required ? ' *' : ''}</span>
                  <input placeholder={field.id} readOnly={field.readOnly} />
                </label>
              ))}
            </div>
          </section>
        ))}
        {!sections.length && <p>No Screen Design sections configured.</p>}
      </div>
      <style jsx>{`
        h2 {
          margin: 0 0 var(--space-3);
          font-size: var(--text-lg);
        }
        .sections {
          display: grid;
          gap: var(--space-4);
        }
        section {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: var(--space-3);
        }
        h3 {
          margin: 0 0 var(--space-2);
        }
        .fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--space-2);
        }
        label {
          display: grid;
          gap: var(--space-1);
        }
        input {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: var(--space-2);
        }
        @media (max-width: 760px) {
          .fields {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Card>
  )
}
