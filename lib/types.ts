export type ShiftType = 'Day' | 'Night'
export type MachineStatus = 'Active' | 'Inactive'
export type OperatorStatus = 'Active' | 'Inactive'
export type ProductCategory = 'Cups' | 'Lids'
export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Adjustment' | 'Settled' | 'Other'

export interface Tenant {
  id: string
  name: string
  phone: string
  created_at: string
}

export interface Machine {
  id: string
  tenant_id: string
  machine_code: string
  machine_name: string
  status: MachineStatus
}

export interface Operator {
  id: string
  tenant_id: string
  operator_code: string
  operator_name: string
  phone: string | null
  status: OperatorStatus
}

export interface Product {
  id: string
  tenant_id: string
  product_code: string
  product_name: string
  category: ProductCategory
  is_active: boolean
}

export interface ProductionRun {
  id: string
  tenant_id: string
  prod_code: string | null
  run_date: string
  product_id: string
  machine_id: string
  operator_id: string
  shift: ShiftType
  cups_per_packet: number
  packets_qty: number
  box_qty: number
  total_cups: number
  notes: string | null
  status: string
  created_at: string
}

export interface Message {
  id: string
  tenant_id: string | null
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
  cups_per_packet: number | null
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
