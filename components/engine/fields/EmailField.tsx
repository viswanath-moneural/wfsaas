'use client'
import Input from '@/components/ui/Input'
import type { FieldInputProps } from './types'

export default function EmailField({ value, onChange, disabled, readOnly }: FieldInputProps) {
  if (readOnly && value) return <a href={`mailto:${value}`}>{value}</a>
  return <Input type="email" value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled || readOnly} />
}

