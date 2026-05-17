export type FieldType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'picklist'
  | 'multi_picklist'
  | 'email'
  | 'phone'
  | 'url'
  | 'lookup'
  | 'formula'
  | 'autonumber'
  | 'rich_text'

export type BondType = 'lookup' | 'master_detail' | 'many_to_many'

export interface ElementDefinition {
  element_key: string
  element_name: string
  element_name_plural: string
  description: string | null
  icon: string | null
  color: string | null
  table_name: string
  is_core: boolean
  is_active: boolean
}

export interface PicklistOption {
  label: string
  value: string
  color?: string
  is_default?: boolean
}

export interface DataPointDefinition {
  id: string
  element_key: string
  field_key: string
  field_label: string
  field_type: FieldType
  is_core: boolean
  is_required: boolean
  is_unique: boolean
  is_read_only: boolean
  is_system: boolean
  default_value: string | null
  help_text: string | null
  options: PicklistOption[]
  lookup_element_key: string | null
  lookup_display_field: string | null
  formula: string | null
  min_value: number | null
  max_value: number | null
  decimal_places?: number | null
  max_length?: number | null
  sort_order: number
}

export interface DataBondDefinition {
  bond_key: string
  bond_name: string
  bond_type: BondType
  from_element_key: string
  from_field_key: string
  to_element_key: string
  to_field_key: string
  display_field_key: string | null
  related_list_label: string | null
  on_delete: 'restrict' | 'cascade' | 'set_null'
  is_core: boolean
}

export interface DataRuleDefinition {
  rule_key: string
  rule_name: string
  condition_formula: string
  error_message: string
  error_field_key: string | null
  trigger_on: ('insert' | 'update')[]
  is_active: boolean
}

export interface ScreenField {
  field_key: string
  column: 1 | 2
  row: number
  is_required_override?: boolean
  is_readonly_override?: boolean
  label_override?: string | null
}

export interface ScreenSection {
  id: string
  title: string
  columns: 1 | 2
  collapsible: boolean
  fields: ScreenField[]
}

export interface ElementMetadata {
  element: ElementDefinition
  fields: DataPointDefinition[]
  bonds: DataBondDefinition[]
  rules: DataRuleDefinition[]
  default_layout: { sections: ScreenSection[] } | null
}
