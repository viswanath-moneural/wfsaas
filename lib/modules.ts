// ============================================================
// MODULE REGISTRY
// Single source of truth for all ERP modules.
// Controls: sidebar nav, permission checks, admin toggles.
// ============================================================

export type ModuleKey =
  | 'dashboard'
  | 'sales'
  | 'purchases'
  | 'manufacturing'
  | 'inventory'
  | 'crm'
  | 'hr'
  | 'reports'
  | 'configuration'

export interface SubModule {
  key: string
  label: string
  href: string
  permission?: string   // module_key for permission check, defaults to parent
  comingSoon?: boolean
}

export interface ModuleDefinition {
  key: ModuleKey
  label: string
  description: string
  icon: string          // Lucide icon name
  href: string          // Landing page
  color: string         // For module cards in admin
  alwaysOn?: boolean    // Cannot be disabled (dashboard, configuration)
  adminOnly?: boolean   // Only admins see this
  comingSoon?: boolean
  subModules: SubModule[]
}

export const MODULE_REGISTRY: Record<ModuleKey, ModuleDefinition> = {
  dashboard: {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Overview, KPIs, and alerts',
    icon: 'LayoutDashboard',
    href: '/dashboard',
    color: '#006F87',
    alwaysOn: true,
    subModules: [],
  },

  sales: {
    key: 'sales',
    label: 'Sales',
    description: 'Orders, invoices, dispatch, payments',
    icon: 'ShoppingCart',
    href: '/sales',
    color: '#16a34a',
    subModules: [
      { key: 'sales.customers',  label: 'Customers',     href: '/sales/customers', comingSoon: true },
      { key: 'sales.orders',     label: 'Sales Orders',  href: '/sales/orders' },
      { key: 'sales.invoices',   label: 'Invoices',      href: '/sales/invoices' },
      { key: 'sales.dispatch',   label: 'Dispatch',      href: '/sales/dispatch' },
      { key: 'sales.returns',    label: 'Returns',       href: '/sales/returns', comingSoon: true },
      { key: 'sales.payments',   label: 'Payments',      href: '/sales/payments' },
      { key: 'sales.pricelists', label: 'Price Lists',   href: '/sales/price-lists', comingSoon: true },
    ],
  },

  purchases: {
    key: 'purchases',
    label: 'Purchases',
    description: 'Purchase orders, GRN, vendor payments',
    icon: 'Package',
    href: '/purchases',
    color: '#d97706',
    subModules: [
      { key: 'purchases.vendors',  label: 'Vendors',           href: '/purchases/vendors', comingSoon: true },
      { key: 'purchases.orders',   label: 'Purchase Orders',   href: '/purchases/orders' },
      { key: 'purchases.grn',      label: 'Goods Receipt',     href: '/purchases/grn' },
      { key: 'purchases.returns',  label: 'Returns',           href: '/purchases/returns', comingSoon: true },
      { key: 'purchases.payments', label: 'Vendor Payments',   href: '/purchases/payments' },
    ],
  },

  manufacturing: {
    key: 'manufacturing',
    label: 'Manufacturing',
    description: 'Work orders, production, BOM, quality',
    icon: 'Factory',
    href: '/manufacturing',
    color: '#7e22ce',
    comingSoon: true,
    subModules: [
      { key: 'manufacturing.workorders',  label: 'Work Orders',       href: '/manufacturing/work-orders', comingSoon: true },
      { key: 'manufacturing.production',  label: 'Production Runs',   href: '/manufacturing/production-runs', comingSoon: true },
      { key: 'manufacturing.machines',    label: 'Machines',          href: '/manufacturing/machines', comingSoon: true },
      { key: 'manufacturing.bom',         label: 'Bill of Materials', href: '/manufacturing/bom', comingSoon: true },
      { key: 'manufacturing.materials',   label: 'Material Usage',    href: '/manufacturing/material-usage', comingSoon: true },
      { key: 'manufacturing.quality',     label: 'Quality Checks',    href: '/manufacturing/quality', comingSoon: true },
      { key: 'manufacturing.downtime',    label: 'Downtime Logs',     href: '/manufacturing/downtime', comingSoon: true },
    ],
  },

  inventory: {
    key: 'inventory',
    label: 'Inventory',
    description: 'Stock levels, movements, warehouses',
    icon: 'Warehouse',
    href: '/inventory',
    color: '#0891b2',
    subModules: [
      { key: 'inventory.stock',       label: 'Stock Levels',    href: '/inventory/stock' },
      { key: 'inventory.movements',   label: 'Movements',       href: '/inventory/movements' },
      { key: 'inventory.adjustments', label: 'Adjustments',     href: '/inventory/adjustments' },
      { key: 'inventory.warehouses',  label: 'Warehouses',      href: '/inventory/warehouses', comingSoon: true },
    ],
  },

  crm: {
    key: 'crm',
    label: 'CRM',
    description: 'Leads, opportunities, quotes, parties',
    icon: 'Users',
    href: '/crm',
    color: '#db2777',
    subModules: [
      { key: 'crm.leads',         label: 'Leads',         href: '/crm/leads' },
      { key: 'crm.opportunities', label: 'Opportunities', href: '/crm/opportunities' },
      { key: 'crm.quotes',        label: 'Quotes',        href: '/crm/quotes' },
      { key: 'crm.parties',       label: 'Parties',       href: '/crm/parties', comingSoon: true },
      { key: 'crm.interactions',  label: 'Interactions',  href: '/crm/interactions' },
    ],
  },

  hr: {
    key: 'hr',
    label: 'HR',
    description: 'Employees, attendance, payroll',
    icon: 'UserCheck',
    href: '/hr',
    color: '#059669',
    subModules: [
      { key: 'hr.employees',   label: 'Employees',   href: '/hr/employees' },
      { key: 'hr.attendance',  label: 'Attendance',  href: '/hr/attendance' },
      { key: 'hr.payroll',     label: 'Payroll',     href: '/hr/payroll' },
      { key: 'hr.salary',      label: 'Salary Structures', href: '/hr/salary', comingSoon: true },
    ],
  },

  reports: {
    key: 'reports',
    label: 'Reports',
    description: 'Analytics, exports, saved reports',
    icon: 'BarChart2',
    href: '/reports',
    color: '#6366f1',
    comingSoon: true,
    subModules: [
      { key: 'reports.sales',    label: 'Sales Reports',    href: '/reports/sales', comingSoon: true },
      { key: 'reports.purchase', label: 'Purchase Reports', href: '/reports/purchase', comingSoon: true },
      { key: 'reports.production',label:'Production Reports',href: '/reports/production', comingSoon: true },
      { key: 'reports.inventory',label: 'Inventory Reports',href: '/reports/inventory', comingSoon: true },
      { key: 'reports.hr',       label: 'HR Reports',       href: '/reports/hr', comingSoon: true },
      { key: 'reports.saved',    label: 'Saved Reports',    href: '/reports/saved', comingSoon: true },
    ],
  },

  configuration: {
    key: 'configuration',
    label: 'Configuration',
    description: 'System setup, users, roles, masters',
    icon: 'Settings',
    href: '/configuration',
    color: '#475569',
    alwaysOn: true,
    adminOnly: true,
    subModules: [
      { key: 'configuration.org',        label: 'Organisation',     href: '/configuration/organisation' },
      { key: 'configuration.tenants',    label: 'Factories',        href: '/configuration/tenants' },
      { key: 'configuration.users',      label: 'Users',            href: '/configuration/users' },
      { key: 'configuration.roles',      label: 'Roles & Permissions', href: '/configuration/roles' },
      { key: 'configuration.modules',    label: 'Modules',          href: '/configuration/modules' },
      { key: 'configuration.numberseries',label:'Number Series',    href: '/configuration/number-series' },
      { key: 'configuration.products',   label: 'Products',         href: '/configuration/products' },
      { key: 'configuration.materials',  label: 'Materials',        href: '/configuration/materials' },
      { key: 'configuration.customfields',label:'Custom Fields',    href: '/configuration/custom-fields', comingSoon: true },
      { key: 'configuration.whatsapp',   label: 'WhatsApp',         href: '/configuration/whatsapp', comingSoon: true },
    ],
  },
}

export const MODULE_LIST = Object.values(MODULE_REGISTRY)

// Modules visible in the sidebar (ordered)
export const SIDEBAR_MODULE_ORDER: ModuleKey[] = [
  'dashboard',
  'sales',
  'purchases',
  'manufacturing',
  'inventory',
  'crm',
  'hr',
  'reports',
  'configuration',
]
