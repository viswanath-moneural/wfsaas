'use client'

import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Button from '@/components/ui/Button'
import type { LayoutSection } from '@/app/actions/systemSetup/layouts'

function isVisible(field: any, values: Record<string, unknown>) {
  if (field.visible === false) return false
  if (!field.visibility?.field) return true
  return String(values[field.visibility.field] ?? '') === String(field.visibility.value ?? '')
}

export default function DynamicFormClient({
  moduleKey,
  sections,
  defaultValues,
  readOnly,
}: {
  moduleKey: string
  sections: LayoutSection[]
  defaultValues: Record<string, unknown>
  readOnly: boolean
}) {
  const schema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {}
    sections.flatMap((section) => section.fields).forEach((field) => {
      shape[field.id] = field.required ? z.string().min(1, `${field.label} is required`) : z.string().optional()
    })
    return z.object(shape)
  }, [sections])

  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(sections.flatMap((section) => section.fields).map((field) => [field.id, String(defaultValues[field.id] ?? '')])),
  })
  const values = form.watch()

  return (
    <form className="dynamic-form" onSubmit={form.handleSubmit(() => undefined)} data-module={moduleKey}>
      {sections.map((section) => (
        <section key={section.id} className="dynamic-section">
          <h2>{section.title}</h2>
          <div className={`dynamic-fields columns-${section.columns}`}>
            {section.fields.filter((field) => isVisible(field, values)).map((field) => (
              <label key={field.id}>
                <span>{field.label}{field.required ? ' *' : ''}</span>
                <input
                  {...form.register(field.id)}
                  readOnly={readOnly || Boolean(field.readOnly)}
                  aria-invalid={Boolean(form.formState.errors[field.id])}
                />
                {field.helpText && <small>{field.helpText}</small>}
                {form.formState.errors[field.id]?.message && <small className="field-error">{String(form.formState.errors[field.id]?.message)}</small>}
              </label>
            ))}
          </div>
        </section>
      ))}
      {!readOnly && <Button type="submit">Submit</Button>}
      <style jsx>{`
        .dynamic-form {
          display: grid;
          gap: var(--space-5);
        }
        .dynamic-section {
          display: grid;
          gap: var(--space-3);
          padding: var(--space-4);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--surface-card);
        }
        h2 {
          margin: 0;
          font-size: var(--text-lg);
        }
        .dynamic-fields {
          display: grid;
          gap: var(--space-3);
        }
        .columns-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        label {
          display: grid;
          gap: var(--space-1);
        }
        span {
          color: var(--text-primary);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }
        input {
          height: 38px;
          padding: 0 var(--space-3);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          font: inherit;
        }
        input[aria-invalid="true"] {
          border-color: var(--color-danger-500);
        }
        small {
          color: var(--text-secondary);
          font-size: var(--text-xs);
        }
        .field-error {
          color: var(--text-danger);
        }
        @media (max-width: 720px) {
          .columns-2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  )
}
