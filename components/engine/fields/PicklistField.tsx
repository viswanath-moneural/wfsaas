'use client'
import Select from '@/components/ui/Select'
import type { FieldInputProps } from './types'

export default function PicklistField({ field, value, onChange, disabled, readOnly }: FieldInputProps) {
  return (
    <Select value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled || readOnly}>
      <option value="">Select</option>
      {(field.options ?? []).map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </Select>
  )
}

