'use client'
import type { FieldInputProps } from './types'

export default function MultiPicklistField({ field, value, onChange, disabled, readOnly }: FieldInputProps) {
  const current: string[] = Array.isArray(value) ? value : []
  return (
    <select
      multiple
      value={current}
      onChange={(event) => onChange(Array.from(event.target.selectedOptions).map((opt) => opt.value))}
      disabled={disabled || readOnly}
      style={{ minHeight: 110, width: '100%' }}
    >
      {(field.options ?? []).map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  )
}

