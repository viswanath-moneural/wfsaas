'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Button from '@/components/ui/Button'
import SectionRenderer from './SectionRenderer'
import { useDataRules } from '@/lib/engine/data-rules-client'

interface DynamicFormProps {
  elementKey: string
  recordId?: string
  initialValues?: Record<string, any>
  onSuccess?: (record: any) => void
  onCancel?: () => void
  mode?: 'create' | 'edit' | 'read'
  embedded?: boolean
}

export function DynamicForm({
  elementKey,
  recordId,
  initialValues = {},
  onSuccess,
  onCancel,
  mode = 'edit',
  embedded = false,
}: DynamicFormProps) {
  const [metadata, setMetadata] = useState<any>(null)
  const [layout, setLayout] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>('')
  const [editing, setEditing] = useState(mode === 'create' || mode === 'edit')
  const { validate } = useDataRules(elementKey)

  const schema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {}
    const fields = metadata?.fields ?? []
    for (const field of fields) {
      shape[field.field_key] = field.is_required ? z.any().refine((v) => v !== '' && v !== null && v !== undefined, `${field.field_label} is required`) : z.any().optional()
    }
    return z.object(shape)
  }, [metadata])

  const form = useForm<Record<string, any>>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetch(`/api/metadata/elements/${elementKey}`).then((res) => res.json()),
      fetch(`/api/metadata/elements/${elementKey}/layouts/default`).then((res) => res.json()),
      recordId ? fetch(`/api/elements/${elementKey}/records/${recordId}`).then((res) => res.json()) : Promise.resolve(null),
    ]).then(([meta, layoutData, record]) => {
      if (!mounted) return
      setMetadata(meta)
      setLayout(layoutData)
      const values = record?.record ?? initialValues
      form.reset(values)
      setLoading(false)
    }).catch(() => {
      if (!mounted) return
      setFormError('Failed to load metadata or record.')
      setLoading(false)
    })
    return () => { mounted = false }
  }, [elementKey, recordId, form, initialValues])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const values = form.getValues()
      localStorage.setItem(`draft_${elementKey}_${recordId ?? 'new'}`, JSON.stringify(values))
    }, 30000)
    return () => window.clearInterval(interval)
  }, [elementKey, form, recordId])

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (form.formState.isDirty && editing) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', listener)
    return () => window.removeEventListener('beforeunload', listener)
  }, [editing, form.formState.isDirty])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isSave = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's'
      if (isSave && editing) {
        event.preventDefault()
        void form.handleSubmit(onSubmit)()
      }
      if (event.key === 'Escape' && editing && mode !== 'create') {
        setEditing(false)
        onCancel?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function onSubmit(values: Record<string, any>) {
    setFieldErrors({})
    setFormError('')
    const client = validate(values, recordId ? 'update' : 'insert')
    if (!client.valid) {
      const nextErrors: Record<string, string> = {}
      for (const err of client.errors) if (err.field_key) nextErrors[err.field_key] = err.message
      setFieldErrors(nextErrors)
      setFormError(client.errors.find((x) => !x.field_key)?.message ?? 'Validation failed.')
      return
    }

    const payload = { recordData: values, operation: recordId ? 'update' : 'insert' }
    const validateRes = await fetch(`/api/metadata/elements/${elementKey}/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    }).then((res) => res.json())
    if (!validateRes.valid) {
      const nextErrors: Record<string, string> = {}
      for (const err of validateRes.errors ?? []) if (err.field_key) nextErrors[err.field_key] = err.message
      setFieldErrors(nextErrors)
      setFormError((validateRes.errors ?? []).find((x: any) => !x.field_key)?.message ?? 'Server validation failed.')
      return
    }

    const method = recordId ? 'PATCH' : 'POST'
    const url = recordId ? `/api/elements/${elementKey}/records/${recordId}` : `/api/elements/${elementKey}/records`
    const result = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ recordData: values }),
    }).then((res) => res.json())
    if (result.error) {
      setFormError(result.error)
      return
    }
    form.reset(result.record)
    setEditing(false)
    onSuccess?.(result.record)
  }

  if (loading) return <div>Loading sections...</div>
  if (formError && !metadata) return <div className="error-panel">{formError}</div>

  const sections = layout?.sections ?? []
  const values = form.watch()

  const content = (
    <form onSubmit={form.handleSubmit(onSubmit)} className="dynamic-form-engine">
      {sections.map((section: any) => (
        <SectionRenderer
          key={section.id}
          section={section}
          fields={metadata?.fields ?? []}
          values={values}
          errors={fieldErrors}
          onChange={(fieldKey, value) => form.setValue(fieldKey, value, { shouldDirty: true })}
          mode={editing ? (recordId ? 'edit' : 'create') : 'read'}
        />
      ))}
      {formError ? <div className="form-error">{formError}</div> : null}
      {!embedded && (
        <div className="actions">
          {recordId && !editing ? <Button type="button" onClick={() => setEditing(true)}>Edit</Button> : null}
          {editing ? (
            <>
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit">{recordId ? 'Save Changes' : 'Save'}</Button>
            </>
          ) : null}
        </div>
      )}
      <style jsx>{`
        .dynamic-form-engine { display: grid; gap: var(--space-4); }
        .actions { display: flex; gap: var(--space-2); justify-content: flex-end; }
        .form-error { color: var(--text-danger); }
      `}</style>
    </form>
  )

  return embedded ? content : <div className="card">{content}</div>
}

export default DynamicForm
