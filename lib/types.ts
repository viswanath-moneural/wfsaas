export type ShiftType = 'Day' | 'Night'
export type MachineStatus = 'Active' | 'Inactive'
export type OperatorStatus = 'Active' | 'Inactive'
export type ProductCategory = 'Cups' | 'Lids'
export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Adjustment' | 'Settled' | 'Other'

// Temporary broad Database type until Supabase generated types are added.
// This keeps the typed client usable while the MVP routes are being wired.
export type Database = any

export interface BusinessUnit {
  id: string
  name: string
  phone: string
  created_at: string
}

export interface Machine {
  id: string
  business_unit_id: string
  machine_code: string
  machine_name: string
  status: MachineStatus
}

export interface Operator {
  id: string
  business_unit_id: string
  operator_code: string
  operator_name: string
  phone: string | null
  status: OperatorStatus
}

export interface Product {
  id: string
  business_unit_id: string
  product_code: string
  product_name: string
  category: ProductCategory
  is_active: boolean
}

export interface ProductionRun {
  id: string
  business_unit_id: string
  prod_code: string | null
  run_date: string
  product_id: string
  machine_id: string
  operator_id: string
  shift: ShiftType
  pack_quantity: number
  packets_qty: number
  box_qty: number
  total_cups: number
  notes: string | null
  status: string
  created_at: string
}

export interface Message {
  id: string
  business_unit_id: string | null
  phone: string
  content: string
  parsed_type: string | null
  created_at: string
}

// Parser output type
export interface ParsedProduction {
  machine_code: string | null
  product_code: string | null
  shift: ShiftType | null
  packets_qty: number | null
  pack_quantity: number | null
  operator_code: string | null
  confidence: 'high' | 'low'
}

// Dashboard metric types
export interface DashboardStats {
  total_cups_today: number
  total_packets_today: number
  active_machines_today: number
  shifts_reported: number
  messages_today: number
  unknown_messages: number
}





