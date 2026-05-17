'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useDataRules } from '@/lib/engine/data-rules-client'

function renderControl(field: any, register: any, readOnly: boolean) {
  const common = { ...register(field.field_key), disabled: readOnly || field.is_read_only }
  switch (field.field_type) {
    case 'long_text':
    case 'rich_text':
      return <textarea {...common} rows={3} />
    case 'number':
    case 'currency':
    case 'percentage':
      return <input type="number" step="any" {...common} />
    case 'date':
      return <input type="date" {...common} />
    case 'datetime':
      return <input type="datetime-local" {...common} />
    case 'boolean':
      return <input type="checkbox" {...common} />
    case 'picklist':
      return (
        <select {...common}>
          <option value="">Select</option>
          {(field.options ?? []).map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )
    default:
      return <input type="text" {...common} />
  }
}

export default function ElementDynamicFormClient({
  elementKey,
  defaultValues,
  operation,
}: {
  elementKey: string
  defaultValues: Record<string, any>
  operation: 'insert' | 'update'
}) {
  const [metadata, setMetadata] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { validate, loading: rulesLoading } = useDataRules(elementKey)

  const form = useForm<Record<string, any>>({ defaultValues })

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetch(`/api/metadata/elements/${elementKey}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return
        setMetadata(json)
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [elementKey])

  const layoutSections = useMemo(() => metadata?.default_layout?.sections ?? [], [metadata])
  const fieldsByKey = useMemo(() => new Map<string, any>((metadata?.fields ?? []).map((field: any) => [field.field_key, field])), [metadata])

  async function onSubmit(values: Record<string, any>) {
    setSubmitError(null)
    setFieldErrors({})

    const clientResult = validate(values, operation)
    if (!clientResult.valid) {
      const nextErrors: Record<string, string> = {}
      for (const error of clientResult.errors) {
        if (error.field_key) nextErrors[error.field_key] = error.message
      }
      setFieldErrors(nextErrors)
      setSubmitError(clientResult.errors.find((e) => !e.field_key)?.message ?? 'Validation failed')
      return
    }

    const res = await fetch(`/api/metadata/elements/${elementKey}/validate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recordData: values, operation }),
    })
    const json = await res.json()
    if (!json.valid) {
      const nextErrors: Record<string, string> = {}
      for (const error of json.errors ?? []) {
        if (error.field_key) nextErrors[error.field_key] = error.message
      }
      setFieldErrors(nextErrors)
      setSubmitError((json.errors ?? []).find((e: any) => !e.field_key)?.message ?? 'Server validation failed')
      return
    }

    setSubmitError(null)
    alert('Validation passed. Connect this to your create/update action.')
  }

  if (loading || rulesLoading) return <div>Loading metadata...</div>
  if (!metadata?.element) return <div className="error-panel">Element metadata not found.</div>

  return (
    <form className="dynamic-form" onSubmit={form.handleSubmit(onSubmit)}>
      {layoutSections.map((section: any) => (
        <section key={section.id} className="dynamic-section">
          <h3>{section.title}</h3>
          <div className={`field-grid columns-${section.columns ?? 2}`}>
            {(section.fields ?? []).map((layoutField: any) => {
              const field = fieldsByKey.get(layoutField.field_key)
              if (!field) return null
              const label = layoutField.label_override || field.field_label
              const required = layoutField.is_required_override ?? field.is_required
              const error = fieldErrors[field.field_key]
              return (
                <label key={field.field_key} className="field-block">
                  <span>{label}{required ? ' *' : ''}</span>
                  {renderControl(field, form.register, layoutField.is_readonly_override ?? false)}
                  {error ? <small className="field-error">{error}</small> : null}
                </label>
              )
            })}
          </div>
        </section>
      ))}
      {submitError ? <div className="form-error">{submitError}</div> : null}
      <Button type="submit">Submit</Button>
      <style jsx>{`
        .dynamic-form { display: grid; gap: var(--space-4); }
        .dynamic-section { border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-4); background: var(--surface-card); }
        .field-grid { display: grid; gap: var(--space-3); }
        .columns-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .field-block { display: grid; gap: var(--space-1); }
        .field-block input, .field-block select, .field-block textarea { border: 1px solid var(--border-default); border-radius: var(--radius-md); padding: var(--space-2); font: inherit; }
        .field-error { color: var(--text-danger); }
        @media (max-width: 768px) { .columns-2 { grid-template-columns: 1fr; } }
      `}</style>
    </form>
  )
}
