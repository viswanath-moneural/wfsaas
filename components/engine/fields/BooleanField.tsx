'use client'
import Switch from '@/components/ui/Switch'
import type { FieldInputProps } from './types'

export default function BooleanField({ value, onChange, disabled, readOnly }: FieldInputProps) {
  const checked = Boolean(value)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled || readOnly} />
      <span>{checked ? 'Yes' : 'No'}</span>
    </div>
  )
}

