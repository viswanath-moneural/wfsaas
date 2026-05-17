'use client'
import Input from '@/components/ui/Input'
import type { FieldInputProps } from './types'

export default function NumberField({ field, value, onChange, disabled, readOnly }: FieldInputProps) {
  return (
    <Input
      type="number"
      value={value ?? ''}
      min={field.min_value ?? undefined}
      max={field.max_value ?? undefined}
      step={field.decimal_places ? 1 / Math.pow(10, field.decimal_places) : 'any'}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      disabled={disabled || readOnly}
    />
  )
}

