'use client'
import type { FieldInputProps } from './types'

export default function LongTextField({ field, value, onChange, disabled, readOnly }: FieldInputProps) {
  return (
    <div>
      <textarea
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || readOnly}
        maxLength={field.max_length ?? undefined}
        rows={3}
        style={{ width: '100%', resize: 'vertical' }}
      />
      {field.max_length ? <small>{String(value ?? '').length}/{field.max_length}</small> : null}
    </div>
  )
}

