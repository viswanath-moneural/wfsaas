'use client'
import type { FieldInputProps } from './types'

export default function RichTextField({ value, onChange, disabled, readOnly }: FieldInputProps) {
  if (readOnly) return <div dangerouslySetInnerHTML={{ __html: String(value ?? '') }} />
  return (
    <textarea
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      rows={5}
      style={{ width: '100%' }}
    />
  )
}

