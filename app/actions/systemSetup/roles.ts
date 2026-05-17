'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase.server'

export type SystemSetupActionResult<T> = { data: T | null; error: string | null }

const MODULES = [
  'sales_orders',
  'invoices',
  'customers',
  'vendors',
  'products',
  'production_runs',
  'purchase_orders',
  'inventory',
  'expenses',
  'payroll',
  'reports',
  'settings',
]

const FIELD_TABLES: Record<string, string[]> = {
  sales_orders: ['so_code', 'customer_id', 'order_date', 'expected_date', 'status', 'total_amount', 'notes'],
  invoices: ['invoice_no', 'customer_id', 'invoice_date', 'due_date', 'subtotal', 'total_amount', 'status'],
  customers: ['customer_code', 'customer_name', 'company_name', 'phone', 'gst_number', 'address', 'city', 'state'],
  vendors: ['vendor_code', 'vendor_name', 'phone', 'gst_number', 'payment_terms', 'is_active'],
  products: ['product_code', 'product_name', 'category', 'sku', 'reorder_level', 'is_active'],
  production_runs: ['prod_code', 'run_date', 'product_id', 'machine_id', 'operator_id', 'shift', 'status'],
  purchase_orders: ['po_code', 'po_date', 'vendor_id', 'status', 'expected_date', 'notes'],
  inventory: ['item_type', 'item_id', 'qty', 'unit', 'warehouse_id', 'location_id', 'notes'],
  expenses: ['expense_code', 'expense_date', 'category_id', 'description', 'amount', 'payment_mode', 'approved_by'],
  payroll: ['month_year', 'employee_id', 'days_present', 'gross_pay', 'deductions', 'net_pay', 'status'],
  reports: ['report_name', 'module_key', 'filters', 'columns', 'sort_config', 'is_shared'],
  settings: ['name', 'description', 'is_active', 'sort_order'],
}

function ok<T>(data: T): SystemSetupActionResult<T> {
  return { data, error: null }
}

function fail<T = never>(error: unknown): SystemSetupActionResult<T> {
  return { data: null, error: error instanceof Error ? error.message : String(error || 'System Setup action failed.') }
}

function roleName(role: any) {
  return String(role?.role_name ?? role?.name ?? role?.label ?? '').trim()
}

function normalizeRoleName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function tableLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

async function requireSetupAdmin() {
  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('You must be signed in.')

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*, roles(role_name, name, label)')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (userError) throw userError
  if (!user || user.is_active === false) throw new Error('Your user profile is not active.')

  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('role_id, roles(role_name, name, label)')
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
  if (roleError) throw roleError

  const roleNames = [
    String(user.role ?? '').toLowerCase(),
    String(user.roles?.role_name ?? user.roles?.name ?? user.roles?.label ?? '').toLowerCase(),
    ...((roleRows ?? []).map((row: any) => String(row.roles?.role_name ?? row.roles?.name ?? row.roles?.label ?? '').toLowerCase())),
  ]

  if (!roleNames.includes('superadmin') && !roleNames.includes('admin')) {
    throw new Error('Only admins can manage System Setup.')
  }

  return { supabase, user, isSuperadmin: roleNames.includes('superadmin') }
}

async function assertRoleAccess(supabase: any, actor: any, isSuperadmin: boolean, roleId: string) {
  const { data: role, error } = await supabase.from('roles').select('*').eq('id', roleId).maybeSingle()
  if (error) throw error
  if (!role) throw new Error('Role not found.')
  if (!isSuperadmin && role.org_id !== actor.org_id) throw new Error('Cannot manage a role outside your organisation.')
  return role
}

export async function getRoleManagerData() {
  try {
    const { supabase, user, isSuperadmin } = await requireSetupAdmin()
    const rolesQuery = supabase.from('roles').select('*').order('created_at', { ascending: false })
    const usersQuery = supabase.from('users').select('id, role_id, org_id')

    const [{ data: roles, error: roleError }, { data: users, error: userError }] = await Promise.all([
      isSuperadmin ? rolesQuery : rolesQuery.eq('org_id', user.org_id),
      isSuperadmin ? usersQuery : usersQuery.eq('org_id', user.org_id),
    ])
    if (roleError) throw roleError
    if (userError) throw userError

    const counts: Record<string, number> = {}
    ;(users ?? []).forEach((row: any) => {
      if (row.role_id) counts[row.role_id] = (counts[row.role_id] ?? 0) + 1
    })

    return ok({ roles: roles ?? [], userCounts: counts, currentUser: user })
  } catch (error) {
    return fail(error)
  }
}

export async function getRoleDetailData(roleId: string) {
  try {
    const { supabase, user, isSuperadmin } = await requireSetupAdmin()
    const role = await assertRoleAccess(supabase, user, isSuperadmin, roleId)
    const [
      { data: users, error: userError },
      { data: modulePermissions, error: moduleError },
      { data: fieldPermissions, error: fieldError },
    ] = await Promise.all([
      supabase.from('users').select('id').eq('role_id', roleId),
      supabase.from('role_permissions').select('*').eq('role_id', roleId),
      supabase.from('field_permissions').select('*').eq('role_id', roleId),
    ])
    if (userError) throw userError
    if (moduleError) throw moduleError
    if (fieldError) throw fieldError

    return ok({
      role,
      userCount: users?.length ?? 0,
      modules: MODULES,
      fieldTables: Object.entries(FIELD_TABLES).map(([key, fields]) => ({ key, label: tableLabel(key), fields })),
      modulePermissions: modulePermissions ?? [],
      fieldPermissions: fieldPermissions ?? [],
    })
  } catch (error) {
    return fail(error)
  }
}

export async function createRole(input: { role_name: string; description?: string | null }) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const roleNameValue = normalizeRoleName(input.role_name)
    if (!roleNameValue) throw new Error('Role name is required.')

    const { data, error } = await supabase
      .from('roles')
      .insert({
        org_id: user.org_id,
        role_name: roleNameValue,
        name: roleNameValue,
        label: input.role_name.trim(),
        description: input.description?.trim() || null,
        is_system: false,
      })
      .select('*')
      .single()
    if (error) throw error
    revalidatePath('/system-setup/roles')
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function updateRole(roleId: string, input: { role_name: string; description?: string | null }) {
  try {
    const { supabase, user, isSuperadmin } = await requireSetupAdmin()
    const before = await assertRoleAccess(supabase, user, isSuperadmin, roleId)
    const roleNameValue = normalizeRoleName(input.role_name)
    if (!roleNameValue) throw new Error('Role name is required.')

    const updatePayload: Record<string, any> = {
      description: input.description?.trim() || null,
      label: input.role_name.trim(),
      updated_at: new Date().toISOString(),
    }
    if (!before.is_system) {
      updatePayload.role_name = roleNameValue
      updatePayload.name = roleNameValue
    }

    const { data, error } = await supabase.from('roles').update(updatePayload).eq('id', roleId).select('*').single()
    if (error) throw error
    revalidatePath('/system-setup/roles')
    revalidatePath(`/system-setup/roles/${roleId}`)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteRole(roleId: string) {
  try {
    const { supabase, user, isSuperadmin } = await requireSetupAdmin()
    const role = await assertRoleAccess(supabase, user, isSuperadmin, roleId)
    if (role.is_system) throw new Error('System roles cannot be deleted.')
    const { count, error: countError } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('role_id', roleId)
    if (countError) throw countError
    if ((count ?? 0) > 0) throw new Error('Cannot delete a role while users are assigned to it.')
    const { error } = await supabase.from('roles').delete().eq('id', roleId)
    if (error) throw error
    revalidatePath('/system-setup/roles')
    return ok({ id: roleId })
  } catch (error) {
    return fail(error)
  }
}

export async function cloneRole(roleId: string, roleNameInput: string) {
  try {
    const { supabase, user, isSuperadmin } = await requireSetupAdmin()
    const source = await assertRoleAccess(supabase, user, isSuperadmin, roleId)
    const roleNameValue = normalizeRoleName(roleNameInput || `copy_of_${roleName(source)}`)

    const { data: role, error: roleError } = await supabase
      .from('roles')
      .insert({
        org_id: source.org_id,
        role_name: roleNameValue,
        name: roleNameValue,
        label: roleNameInput.trim() || `Copy of ${roleName(source)}`,
        description: source.description,
        is_system: false,
      })
      .select('*')
      .single()
    if (roleError) throw roleError

    const [{ data: moduleRows, error: moduleError }, { data: fieldRows, error: fieldError }] = await Promise.all([
      supabase.from('role_permissions').select('*').eq('role_id', roleId),
      supabase.from('field_permissions').select('*').eq('role_id', roleId),
    ])
    if (moduleError) throw moduleError
    if (fieldError) throw fieldError

    if (moduleRows?.length) {
      const { error } = await supabase.from('role_permissions').insert(moduleRows.map(({ id, role_id, ...row }: any) => ({ ...row, role_id: role.id })))
      if (error) throw error
    }
    if (fieldRows?.length) {
      const { error } = await supabase.from('field_permissions').insert(fieldRows.map(({ id, role_id, ...row }: any) => ({ ...row, role_id: role.id })))
      if (error) throw error
    }

    revalidatePath('/system-setup/roles')
    return ok(role)
  } catch (error) {
    return fail(error)
  }
}

export async function saveModulePermissions(roleId: string, permissions: Array<{ module_key: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }>) {
  try {
    const { supabase, user, isSuperadmin } = await requireSetupAdmin()
    await assertRoleAccess(supabase, user, isSuperadmin, roleId)
    const payload = permissions.map((permission) => ({ role_id: roleId, ...permission }))
    const { error } = await supabase.from('role_permissions').upsert(payload, { onConflict: 'role_id,module_key' })
    if (error) throw error
    revalidatePath(`/system-setup/roles/${roleId}`)
    return ok(payload)
  } catch (error) {
    return fail(error)
  }
}

export async function saveFieldPermissions(roleId: string, tableName: string, permissions: Array<{ field_name: string; can_view: boolean; can_edit: boolean }>) {
  try {
    const { supabase, user, isSuperadmin } = await requireSetupAdmin()
    await assertRoleAccess(supabase, user, isSuperadmin, roleId)
    if (!FIELD_TABLES[tableName]) throw new Error('Unknown module/table.')
    const payload = permissions.map((permission) => ({ role_id: roleId, table_name: tableName, ...permission }))
    const { error } = await supabase.from('field_permissions').upsert(payload, { onConflict: 'role_id,table_name,field_name' })
    if (error) throw error
    revalidatePath(`/system-setup/roles/${roleId}`)
    return ok(payload)
  } catch (error) {
    return fail(error)
  }
}
