'use client'
import Input from '@/components/ui/Input'
import type { FieldInputProps } from './types'

export default function DateField({ value, onChange, disabled, readOnly }: FieldInputProps) {
  return <Input type="date" value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled || readOnly} />
}

