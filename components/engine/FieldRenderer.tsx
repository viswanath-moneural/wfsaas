'use client'

import type { DataPointDefinition } from '@/types/metadata'
import TextField from './fields/TextField'
import LongTextField from './fields/LongTextField'
import NumberField from './fields/NumberField'
import CurrencyField from './fields/CurrencyField'
import PercentageField from './fields/PercentageField'
import DateField from './fields/DateField'
import DateTimeField from './fields/DateTimeField'
import BooleanField from './fields/BooleanField'
import PicklistField from './fields/PicklistField'
import MultiPicklistField from './fields/MultiPicklistField'
import EmailField from './fields/EmailField'
import PhoneField from './fields/PhoneField'
import UrlField from './fields/UrlField'
import LookupField from './fields/LookupField'
import FormulaField from './fields/FormulaField'
import AutonumberField from './fields/AutonumberField'
import RichTextField from './fields/RichTextField'

interface FieldRendererProps {
  field: DataPointDefinition
  value: any
  onChange: (value: any) => void
  error?: string
  mode: 'edit' | 'read' | 'create'
  overrides?: { label?: string; required?: boolean; readOnly?: boolean }
}

function asReadValue(value: any) {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

export function FieldRenderer({ field, value, onChange, error, mode, overrides }: FieldRendererProps) {
  const label = overrides?.label || field.field_label
  const required = overrides?.required ?? field.is_required
  const readOnly = mode === 'read' || overrides?.readOnly || field.is_read_only || field.field_type === 'formula'

  const props = { field, value, onChange, error, readOnly }
  const input = (() => {
    switch (field.field_type) {
      case 'text': return <TextField {...props} />
      case 'long_text': return <LongTextField {...props} />
      case 'number': return <NumberField {...props} />
      case 'currency': return <CurrencyField {...props} />
      case 'percentage': return <PercentageField {...props} />
      case 'date': return <DateField {...props} />
      case 'datetime': return <DateTimeField {...props} />
      case 'boolean': return <BooleanField {...props} />
      case 'picklist': return <PicklistField {...props} />
      case 'multi_picklist': return <MultiPicklistField {...props} />
      case 'email': return <EmailField {...props} />
      case 'phone': return <PhoneField {...props} />
      case 'url': return <UrlField {...props} />
      case 'lookup': return <LookupField {...props} />
      case 'formula': return <FormulaField {...props} />
      case 'autonumber': return <AutonumberField {...props} />
      case 'rich_text': return <RichTextField {...props} />
      default: return <TextField {...props} />
    }
  })()

  return (
    <div className="field-wrapper">
      <label>{label}{required ? ' *' : ''}</label>
      {mode === 'read' ? <div className="read-value">{asReadValue(value)}</div> : input}
      {field.help_text ? <small>{field.help_text}</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
      <style jsx>{`
        .field-wrapper { display: grid; gap: 6px; }
        label { font-size: var(--text-sm); font-weight: var(--font-medium); }
        .read-value { padding: 8px 10px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--surface-muted); }
        .field-error { color: var(--text-danger); }
      `}</style>
    </div>
  )
}

export default FieldRenderer
