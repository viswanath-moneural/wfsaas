'use client'
import Input from '@/components/ui/Input'
import type { FieldInputProps } from './types'

export default function PercentageField({ value, onChange, disabled, readOnly }: FieldInputProps) {
  return (
    <div>
      <Input
        type="number"
        min={0}
        max={100}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        disabled={disabled || readOnly}
      />
      <small>%</small>
    </div>
  )
}

