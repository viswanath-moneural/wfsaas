'use client'

import Input from '@/components/ui/Input'
import type { FieldInputProps } from './types'

export default function TextField({ field, value, onChange, disabled, readOnly }: FieldInputProps) {
  return (
    <div>
      <Input value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled || readOnly} />
      {field.max_length ? <small>{String(value ?? '').length}/{field.max_length}</small> : null}
    </div>
  )
}
