'use client'
import Input from '@/components/ui/Input'
import type { FieldInputProps } from './types'

export default function DateTimeField({ value, onChange, disabled, readOnly }: FieldInputProps) {
  return <Input type="datetime-local" value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled || readOnly} />
}

