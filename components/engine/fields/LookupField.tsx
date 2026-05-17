'use client'
import { useEffect, useState } from 'react'
import Select from '@/components/ui/Select'
import type { FieldInputProps } from './types'

export default function LookupField({ field, value, onChange, disabled, readOnly }: FieldInputProps) {
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([])
  useEffect(() => {
    const key = field.lookup_element_key
    if (!key) return
    fetch(`/api/elements/${key}/records?limit=20`)
      .then((res) => res.json())
      .then((json) => {
        const rows = (json.records ?? []).map((row: any) => ({
          id: row.id,
          label: row[field.lookup_display_field || 'name'] ?? row.name ?? row.id,
        }))
        setOptions(rows)
      })
      .catch(() => setOptions([]))
  }, [field.lookup_display_field, field.lookup_element_key])

  if (readOnly) return <span>{options.find((opt) => opt.id === value)?.label ?? String(value ?? '')}</span>
  return (
    <Select value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} disabled={disabled}>
      <option value="">Select</option>
      {options.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
    </Select>
  )
}

