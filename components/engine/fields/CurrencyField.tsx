'use client'
import NumberField from './NumberField'
import type { FieldInputProps } from './types'

export default function CurrencyField(props: FieldInputProps) {
  return (
    <div>
      <span style={{ marginRight: 6 }}>₹</span>
      <NumberField {...props} />
    </div>
  )
}

