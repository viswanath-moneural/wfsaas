'use server'

import { getSuperadminContext } from '@/lib/auth/getSuperadminContext'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, ok, type SuperadminActionResult } from './_shared'

export interface GlobalSearchFilters {
  query?: string
  orgId?: string
  dateFrom?: string
  dateTo?: string
}

function likeTerm(query: string) {
  return `%${query.replaceAll('%', '').replaceAll(',', ' ').trim()}%`
}

function inList(values: string[]) {
  return values.length ? `(${values.join(',')})` : '(00000000-0000-0000-0000-000000000000)'
}

function dateFilter(query: any, filters: GlobalSearchFilters) {
  let scoped = query
  if (filters.dateFrom) scoped = scoped.gte('created_at', filters.dateFrom)
  if (filters.dateTo) scoped = scoped.lte('created_at', filters.dateTo)
  return scoped
}

export async function globalSearch(filters: GlobalSearchFilters): Promise<SuperadminActionResult<Record<string, any[]>>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const search = (filters.query ?? '').trim()
    const pattern = likeTerm(search)

    const { data: orgs } = await admin.from('organisations').select('id, name, slug')
    const { data: tenants } = await admin.from('tenants').select('id, name, org_id')
    const orgById = new Map((orgs ?? []).map((org: any) => [org.id, org]))
    const tenantById = new Map((tenants ?? []).map((tenant: any) => [tenant.id, tenant]))
    const scopedTenantIds = filters.orgId
      ? (tenants ?? []).filter((tenant: any) => tenant.org_id === filters.orgId).map((tenant: any) => tenant.id)
      : (tenants ?? []).map((tenant: any) => tenant.id)

    let organisationsQuery = dateFilter(admin.from('organisations').select('*').limit(25), filters)
    if (search) organisationsQuery = organisationsQuery.or(`name.ilike.${pattern},slug.ilike.${pattern}`)
    if (filters.orgId) organisationsQuery = organisationsQuery.eq('id', filters.orgId)

    let usersQuery = dateFilter(admin.from('users').select('id, full_name, email, role, is_active, org_id, created_at').limit(25), filters)
    if (search) usersQuery = usersQuery.or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
    if (filters.orgId) usersQuery = usersQuery.eq('org_id', filters.orgId)

    let salesQuery = dateFilter(admin.from('sales_orders').select('*').limit(25), filters)
    if (search) salesQuery = salesQuery.or(`so_code.ilike.${pattern},name.ilike.${pattern},status.ilike.${pattern}`)
    if (filters.orgId) salesQuery = salesQuery.filter('tenant_id', 'in', inList(scopedTenantIds))

    let purchaseQuery = dateFilter(admin.from('purchase_orders').select('*').limit(25), filters)
    if (search) purchaseQuery = purchaseQuery.or(`po_code.ilike.${pattern},name.ilike.${pattern},status.ilike.${pattern}`)
    if (filters.orgId) purchaseQuery = purchaseQuery.filter('tenant_id', 'in', inList(scopedTenantIds))

    let productsQuery = dateFilter(admin.from('products').select('id, tenant_id, product_code, product_name, is_active, created_at').limit(25), filters)
    if (search) productsQuery = productsQuery.or(`product_code.ilike.${pattern},product_name.ilike.${pattern},sku.ilike.${pattern}`)
    if (filters.orgId) productsQuery = productsQuery.filter('tenant_id', 'in', inList(scopedTenantIds))

    let materialsQuery = dateFilter(admin.from('materials').select('id, tenant_id, material_code, material_name, is_active, created_at').limit(25), filters)
    if (search) materialsQuery = materialsQuery.or(`material_code.ilike.${pattern},material_name.ilike.${pattern}`)
    if (filters.orgId) materialsQuery = materialsQuery.filter('tenant_id', 'in', inList(scopedTenantIds))

    let partiesQuery = dateFilter(admin.from('parties').select('*').limit(25), filters)
    if (search) partiesQuery = partiesQuery.or(`party_code.ilike.${pattern},party_name.ilike.${pattern},gst_number.ilike.${pattern}`)
    if (filters.orgId) partiesQuery = partiesQuery.filter('tenant_id', 'in', inList(scopedTenantIds))

    const [
      organisations,
      users,
      salesOrders,
      purchaseOrders,
      products,
      materials,
      parties,
    ] = await Promise.all([
      organisationsQuery,
      usersQuery,
      salesQuery,
      purchaseQuery,
      productsQuery,
      materialsQuery,
      partiesQuery,
    ])

    const orgNameForTenant = (tenantId: string | null) => {
      const tenant = tenantId ? tenantById.get(tenantId) : null
      return tenant ? orgById.get(tenant.org_id)?.name ?? '-' : '-'
    }

    const results = {
      organisations: (organisations.data ?? []).map((row: any) => ({
        id: row.id,
        type: 'Organisation',
        icon: 'Org',
        name: row.name,
        code: row.slug,
        orgName: row.name,
        status: row.is_active ? 'Active' : 'Suspended',
        createdAt: row.created_at,
        href: `/superadmin/organisations/${row.id}`,
      })),
      users: (users.data ?? []).map((row: any) => ({
        id: row.id,
        type: 'User',
        icon: 'User',
        name: row.full_name,
        code: row.email,
        orgName: orgById.get(row.org_id)?.name ?? '-',
        status: row.is_active ? 'Active' : 'Inactive',
        createdAt: row.created_at,
        href: `/superadmin/users/${row.id}`,
      })),
      salesOrders: (salesOrders.data ?? []).map((row: any) => ({
        id: row.id,
        type: 'Sales Order',
        icon: 'SO',
        name: row.name ?? row.so_code,
        code: row.so_code,
        orgName: orgNameForTenant(row.tenant_id),
        status: row.status,
        createdAt: row.created_at,
        href: `/sales/orders/${row.id}`,
      })),
      purchaseOrders: (purchaseOrders.data ?? []).map((row: any) => ({
        id: row.id,
        type: 'Purchase Order',
        icon: 'PO',
        name: row.name ?? row.po_code,
        code: row.po_code,
        orgName: orgNameForTenant(row.tenant_id),
        status: row.status,
        createdAt: row.created_at,
        href: `/purchases/orders/${row.id}`,
      })),
      inventoryItems: [...(products.data ?? []).map((row: any) => ({
        id: row.id,
        type: 'Product',
        icon: 'Item',
        name: row.product_name,
        code: row.product_code,
        orgName: orgNameForTenant(row.tenant_id),
        status: row.is_active ? 'Active' : 'Inactive',
        createdAt: row.created_at,
        href: `/configuration/products`,
      })), ...(materials.data ?? []).map((row: any) => ({
        id: row.id,
        type: 'Material',
        icon: 'Mat',
        name: row.material_name,
        code: row.material_code,
        orgName: orgNameForTenant(row.tenant_id),
        status: row.is_active ? 'Active' : 'Inactive',
        createdAt: row.created_at,
        href: `/configuration/materials`,
      }))],
      parties: (parties.data ?? []).map((row: any) => ({
        id: row.id,
        type: 'Party',
        icon: 'CRM',
        name: row.party_name,
        code: row.party_code,
        orgName: orgNameForTenant(row.tenant_id),
        status: row.is_active ? 'Active' : 'Inactive',
        createdAt: row.created_at,
        href: `/crm/parties`,
      })),
    }

    const queryErrors = [organisations.error, users.error, salesOrders.error, purchaseOrders.error, products.error, materials.error, parties.error].filter(Boolean)
    if (queryErrors.length) throw queryErrors[0]

    return ok(results)
  } catch (error) {
    return fail(error)
  }
}
