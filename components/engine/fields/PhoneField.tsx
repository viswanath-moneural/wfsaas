'use client'
import Input from '@/components/ui/Input'
import type { FieldInputProps } from './types'

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  return raw
}

export default function PhoneField({ value, onChange, disabled, readOnly }: FieldInputProps) {
  if (readOnly && value) return <a href={`tel:${String(value).replace(/\s+/g, '')}`}>{String(value)}</a>
  return <Input type="tel" value={value ?? ''} onChange={(event) => onChange(formatPhone(event.target.value))} disabled={disabled || readOnly} />
}

