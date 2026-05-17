'use client'
import Input from '@/components/ui/Input'
import type { FieldInputProps } from './types'

export default function UrlField({ value, onChange, disabled, readOnly }: FieldInputProps) {
  if (readOnly && value) return <a href={String(value)} target="_blank" rel="noreferrer">{String(value)}</a>
  return <Input type="url" value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled || readOnly} />
}

