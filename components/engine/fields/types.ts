import type { DataPointDefinition } from '@/types/metadata'

export interface FieldInputProps {
  field: DataPointDefinition
  value: any
  onChange: (value: any) => void
  error?: string
  disabled?: boolean
  readOnly?: boolean
}
