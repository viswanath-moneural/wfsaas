export const LAYOUT_MODULES = [
  { key: 'customers', label: 'Customers', icon: 'CU' },
  { key: 'vendors', label: 'Vendors', icon: 'VE' },
  { key: 'products', label: 'Products', icon: 'PR' },
  { key: 'sales_orders', label: 'Sales Orders', icon: 'SO' },
  { key: 'invoices', label: 'Invoices', icon: 'IN' },
  { key: 'purchase_orders', label: 'Purchase Orders', icon: 'PO' },
  { key: 'production_runs', label: 'Production Runs', icon: 'PN' },
  { key: 'inventory', label: 'Inventory', icon: 'IV' },
  { key: 'expenses', label: 'Expenses', icon: 'EX' },
  { key: 'payroll', label: 'Payroll', icon: 'PY' },
]

export const MODULE_FIELDS: Record<string, string[]> = {
  customers: ['customer_code', 'customer_name', 'company_name', 'phone', 'email', 'gst_number', 'address', 'city', 'state', 'pincode', 'payment_terms', 'credit_limit'],
  vendors: ['vendor_code', 'vendor_name', 'phone', 'email', 'gst_number', 'address', 'city', 'state', 'payment_terms', 'is_active'],
  products: ['product_code', 'product_name', 'category', 'sku', 'brand_id', 'hsn_code_id', 'reorder_level', 'is_active'],
  sales_orders: ['so_code', 'customer_id', 'order_date', 'expected_date', 'status', 'notes'],
  invoices: ['invoice_no', 'customer_id', 'invoice_date', 'due_date', 'status', 'subtotal', 'total_amount', 'payment_terms'],
  purchase_orders: ['po_code', 'po_date', 'vendor_id', 'status', 'expected_date', 'notes'],
  production_runs: ['prod_code', 'run_date', 'product_id', 'machine_id', 'operator_id', 'shift', 'target_qty', 'status'],
  inventory: ['item_type', 'item_id', 'qty', 'unit', 'warehouse_id', 'location_id', 'reason_code', 'notes'],
  expenses: ['expense_code', 'expense_date', 'category_id', 'description', 'amount', 'payment_mode', 'approved_by'],
  payroll: ['month_year', 'employee_id', 'days_present', 'overtime_hours', 'gross_pay', 'deductions', 'net_pay', 'status'],
}
