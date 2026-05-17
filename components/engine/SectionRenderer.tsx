'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DataPointDefinition, ScreenSection } from '@/types/metadata'
import FieldRenderer from './FieldRenderer'

interface SectionRendererProps {
  section: ScreenSection
  fields: DataPointDefinition[]
  values: Record<string, any>
  errors: Record<string, string>
  onChange: (fieldKey: string, value: any) => void
  mode: 'edit' | 'read' | 'create'
}

export default function SectionRenderer({ section, fields, values, errors, onChange, mode }: SectionRendererProps) {
  const key = `screen_section_collapsed_${section.id}`
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem(key)
    if (saved) setCollapsed(saved === '1')
  }, [key])

  const map = useMemo(() => new Map(fields.map((field) => [field.field_key, field])), [fields])
  const entries = section.fields
    .map((layoutField) => ({ layoutField, field: map.get(layoutField.field_key) }))
    .filter((x) => Boolean(x.field)) as Array<{ layoutField: any; field: DataPointDefinition }>

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(key, next ? '1' : '0')
  }

  return (
    <section className="section">
      <button className="section-header" type="button" onClick={toggle}>
        <span>{collapsed ? '▶' : '▼'} {section.title}</span>
        {collapsed ? <small>({entries.length} fields)</small> : null}
      </button>
      {!collapsed && (
        <div className={`grid columns-${section.columns}`}>
          {entries.map(({ layoutField, field }) => (
            <FieldRenderer
              key={field.field_key}
              field={field}
              value={values[field.field_key]}
              onChange={(next) => onChange(field.field_key, next)}
              error={errors[field.field_key]}
              mode={mode}
              overrides={{
                label: layoutField.label_override ?? undefined,
                required: layoutField.is_required_override ?? undefined,
                readOnly: layoutField.is_readonly_override ?? undefined,
              }}
            />
          ))}
        </div>
      )}
      <style jsx>{`
        .section { border: 1px solid var(--border-default); border-radius: var(--radius-lg); background: var(--surface-card); overflow: hidden; }
        .section-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) var(--space-4); border: 0; border-bottom: 1px solid var(--border-default); background: transparent; font-weight: var(--font-medium); }
        .grid { display: grid; gap: var(--space-3); padding: var(--space-4); }
        .columns-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (max-width: 768px) { .columns-2 { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}
