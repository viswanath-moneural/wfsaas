export type CloudDefinition = {
  id: string
  cloud_key: string
  cloud_name: string
  description: string | null
  icon: string | null
  color: string | null
  is_active: boolean
  sort_order: number | null
}

export type AppDefinition = {
  id: string
  app_key: string
  app_name: string
  description: string | null
  icon: string | null
  color: string | null
  is_active: boolean
  sort_order: number | null
}

export type ModuleDefinition = {
  id: string
  module_key: string
  module_name: string
  description: string | null
  icon: string | null
  cloud_keys: string[]
  app_keys: string[]
  is_core: boolean
  has_config: boolean
  sort_order: number | null
}

export type ModuleManagerData = {
  clouds: CloudDefinition[]
  apps: AppDefinition[]
  modules: ModuleDefinition[]
  orgClouds: Record<string, boolean>
  orgApps: Record<string, boolean>
  orgModules: Record<string, boolean>
  moduleConfigs: Record<string, any>
  selectedCloudKey: string
  selectedAppKey: string
}

export const MODULE_ROUTE_MAP: Record<string, string> = {
  '/sales/customers': 'customers',
  '/sales/orders': 'sales_orders',
  '/sales/invoices': 'invoices',
  '/sales/dispatch': 'dispatch_orders',
  '/sales/returns': 'sales_returns',
  '/sales/payments': 'customer_payments',
  '/purchases/vendors': 'vendors',
  '/purchases/orders': 'purchase_orders',
  '/purchases/grn': 'goods_receipt',
  '/purchases/returns': 'purchase_returns',
  '/purchases/payments': 'vendor_payments',
  '/manufacturing/work-orders': 'work_orders',
  '/manufacturing/production-runs': 'production_runs',
  '/manufacturing/machines': 'machines',
  '/manufacturing/bom': 'bill_of_materials',
  '/manufacturing/quality': 'quality_checks',
  '/inventory/stock': 'stock_movements',
  '/inventory/movements': 'stock_movements',
  '/inventory/adjustments': 'stock_adjustments',
  '/inventory/warehouses': 'warehouses',
  '/crm/leads': 'leads',
  '/crm/opportunities': 'opportunities',
  '/crm/quotes': 'quotes',
  '/crm/parties': 'parties',
  '/crm/interactions': 'interactions',
  '/hr/employees': 'employees',
  '/hr/attendance': 'attendance',
  '/hr/payroll': 'payroll',
  '/reports': 'reports',
  '/configuration/users': 'users',
  '/configuration/roles': 'roles',
  '/configuration/modules': 'reports',
}

export const FALLBACK_MODULE_KEYS = ['dashboard', 'configuration']
