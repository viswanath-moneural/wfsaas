'use client'
import type { FieldInputProps } from './types'

export default function AutonumberField({ value }: FieldInputProps) {
  return <div style={{ background: 'var(--surface-muted)', padding: '8px 10px', borderRadius: 8 }}>{value ? String(value) : 'Auto-generated'}</div>
}

