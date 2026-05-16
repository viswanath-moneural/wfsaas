'use server'

import { createClient as createSessionClient } from '@/lib/supabase.server'
import { isPrivilegedRole } from '@/lib/auth/isPrivilegedRole'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'

export type PlatformActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; message: string; code?: string }

async function requirePrivilegedRole(): Promise<PlatformActionResult<{ userId: string }>> {
  const sessionClient = await createSessionClient()
  const {
    data: { user },
    error: userError,
  } = await sessionClient.auth.getUser()

  if (userError || !user) {
    return { ok: false, message: 'You must be signed in.', code: 'UNAUTHENTICATED' }
  }

  const admin = getSupabaseAdminClient()
  const { data: appUser, error: appUserError } = await admin
    .from('users')
    .select('id, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (appUserError || !appUser || appUser.is_active === false) {
    return { ok: false, message: 'Your application user profile is not active.', code: 'FORBIDDEN' }
  }

  const { data: roleRows, error: roleError } = await admin
    .from('user_roles')
    .select('roles(role_name)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (roleError) {
    return { ok: false, message: roleError.message, code: 'ROLE_LOOKUP_FAILED' }
  }

  const roleNames = new Set<string>([
    String(appUser.role ?? '').toLowerCase(),
    ...((roleRows ?? []).map((row: any) => String(row.roles?.role_name ?? '').toLowerCase())),
  ])

  if (!Array.from(roleNames).some(isPrivilegedRole)) {
    return { ok: false, message: 'Only superadmin, owner, or admin can perform this action.', code: 'PRIVILEGED_ROLE_REQUIRED' }
  }

  return { ok: true, userId: user.id }
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase()
}

export async function createOrganisation(input: {
  name: string
  slug: string
  country?: string | null
  timezone?: string | null
}): Promise<PlatformActionResult<{ organisationId: string }>> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller

  const name = input.name.trim()
  const slug = normalizeSlug(input.slug)

  if (!name) return { ok: false, message: 'Organisation name is required.', code: 'VALIDATION_ERROR' }
  if (!slug) return { ok: false, message: 'Organisation slug is required.', code: 'VALIDATION_ERROR' }

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from('organisations')
    .insert({
      name,
      slug,
      country: input.country?.trim() || null,
      timezone: input.timezone?.trim() || null,
      is_active: true,
      created_by: caller.userId,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? 'Failed to create organisation.', code: 'ORGANISATION_CREATE_FAILED' }
  }

  return { ok: true, organisationId: data.id }
}

export async function createFactory(input: {
  org_id: string
  name: string
  phone?: string | null
  address?: string | null
}): Promise<PlatformActionResult<{ factoryId: string }>> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller

  const name = input.name.trim()
  if (!input.org_id) return { ok: false, message: 'Organisation is required.', code: 'VALIDATION_ERROR' }
  if (!name) return { ok: false, message: 'Factory name is required.', code: 'VALIDATION_ERROR' }

  const admin = getSupabaseAdminClient()
  const { data: org } = await admin.from('organisations').select('id').eq('id', input.org_id).maybeSingle()
  if (!org) return { ok: false, message: 'Selected organisation was not found.', code: 'ORG_NOT_FOUND' }

  const { data, error } = await admin
    .from('tenants')
    .insert({
      org_id: input.org_id,
      name,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      is_active: true,
      created_by: caller.userId,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? 'Failed to create factory.', code: 'FACTORY_CREATE_FAILED' }
  }

  return { ok: true, factoryId: data.id }
}

export async function assignUserRole(input: {
  user_id: string
  role_id: string
  org_id: string
}): Promise<PlatformActionResult<{ assignmentId: string }>> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller

  if (!input.user_id || !input.role_id || !input.org_id) {
    return { ok: false, message: 'User, role, and organisation are required.', code: 'VALIDATION_ERROR' }
  }

  const admin = getSupabaseAdminClient()
  const [{ data: appUser }, { data: role }] = await Promise.all([
    admin.from('users').select('id').eq('id', input.user_id).eq('org_id', input.org_id).maybeSingle(),
    admin.from('roles').select('id').eq('id', input.role_id).eq('org_id', input.org_id).maybeSingle(),
  ])

  if (!appUser) return { ok: false, message: 'Selected user does not belong to this organisation.', code: 'USER_NOT_FOUND' }
  if (!role) return { ok: false, message: 'Selected role does not belong to this organisation.', code: 'ROLE_NOT_FOUND' }

  const { data: existing } = await admin
    .from('user_roles')
    .select('id')
    .eq('user_id', input.user_id)
    .eq('role_id', input.role_id)
    .eq('is_active', true)
    .maybeSingle()

  if (existing?.id) return { ok: true, assignmentId: existing.id }

  const { data, error } = await admin
    .from('user_roles')
    .insert({
      user_id: input.user_id,
      role_id: input.role_id,
      assigned_by: caller.userId,
      assigned_at: new Date().toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      created_by: caller.userId,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? 'Failed to assign user role.', code: 'ROLE_ASSIGN_FAILED' }
  }

  return { ok: true, assignmentId: data.id }
}

export async function toggleModule(input: {
  org_id: string
  module_key: string
  enabled: boolean
}): Promise<PlatformActionResult> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller

  if (!input.org_id || !input.module_key) {
    return { ok: false, message: 'Organisation and module are required.', code: 'VALIDATION_ERROR' }
  }

  const admin = getSupabaseAdminClient()
  const { data: existing, error: lookupError } = await admin
    .from('org_modules')
    .select('id')
    .eq('org_id', input.org_id)
    .eq('module_key', input.module_key)
    .maybeSingle()

  if (lookupError) return { ok: false, message: lookupError.message, code: 'MODULE_LOOKUP_FAILED' }

  const result = existing?.id
    ? await admin
        .from('org_modules')
        .update({
          is_enabled: input.enabled,
          last_modified_at: new Date().toISOString(),
          last_modified_by: caller.userId,
        })
        .eq('id', existing.id)
    : await admin
        .from('org_modules')
        .insert({
          org_id: input.org_id,
          module_key: input.module_key,
          is_enabled: input.enabled,
          created_at: new Date().toISOString(),
          created_by: caller.userId,
        })

  if (result.error) {
    return { ok: false, message: result.error.message, code: 'MODULE_TOGGLE_FAILED' }
  }

  return { ok: true }
}

export async function createRole(input: {
  org_id: string
  role_name: string
  description?: string | null
}): Promise<PlatformActionResult<{ roleId: string }>> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller

  const roleName = input.role_name.trim().toLowerCase()
  if (!input.org_id || !roleName) return { ok: false, message: 'Organisation and role name are required.', code: 'VALIDATION_ERROR' }

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from('roles')
    .insert({
      org_id: input.org_id,
      role_name: roleName,
      description: input.description?.trim() || null,
      is_system: false,
      created_at: new Date().toISOString(),
      created_by: caller.userId,
    })
    .select('id')
    .single()

  if (error || !data?.id) return { ok: false, message: error?.message ?? 'Failed to create role.', code: 'ROLE_CREATE_FAILED' }
  return { ok: true, roleId: data.id }
}

export async function saveNumberSeries(input: {
  tenant_id: string
  entity_type: string
  prefix?: string | null
  suffix?: string | null
  separator?: string | null
  num_digits: number
  start_from: number
  include_fin_year: boolean
  include_month: boolean
}): Promise<PlatformActionResult> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller

  if (!input.tenant_id || !input.entity_type) return { ok: false, message: 'Factory and entity type are required.', code: 'VALIDATION_ERROR' }

  const admin = getSupabaseAdminClient()
  const payload = {
    tenant_id: input.tenant_id,
    entity_type: input.entity_type,
    prefix: input.prefix?.trim() || null,
    suffix: input.suffix?.trim() || null,
    separator: input.separator?.trim() || '-',
    num_digits: input.num_digits,
    start_from: input.start_from,
    include_fin_year: input.include_fin_year,
    include_month: input.include_month,
    is_active: true,
    last_modified_at: new Date().toISOString(),
    last_modified_by: caller.userId,
  }

  const { data: existing, error: lookupError } = await admin
    .from('number_series_config')
    .select('id')
    .eq('tenant_id', input.tenant_id)
    .eq('entity_type', input.entity_type)
    .maybeSingle()

  if (lookupError) return { ok: false, message: lookupError.message, code: 'NUMBER_SERIES_LOOKUP_FAILED' }

  const result = existing?.id
    ? await admin.from('number_series_config').update(payload).eq('id', existing.id)
    : await admin.from('number_series_config').insert({ ...payload, created_at: new Date().toISOString(), created_by: caller.userId })

  if (result.error) return { ok: false, message: result.error.message, code: 'NUMBER_SERIES_SAVE_FAILED' }
  return { ok: true }
}

export async function createProduct(input: {
  tenant_id: string
  product_code: string
  product_name: string
  category: string
  sku?: string | null
  reorder_level?: number | null
}): Promise<PlatformActionResult> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('products').insert({
    tenant_id: input.tenant_id,
    product_code: input.product_code.trim(),
    product_name: input.product_name.trim(),
    category: input.category,
    sku: input.sku?.trim() || null,
    reorder_level: input.reorder_level ?? null,
    is_active: true,
    created_at: new Date().toISOString(),
    created_by: caller.userId,
  })
  if (error) return { ok: false, message: error.message, code: 'PRODUCT_CREATE_FAILED' }
  return { ok: true }
}

export async function createMaterial(input: {
  tenant_id: string
  material_code: string
  material_name: string
  unit: string
  reorder_level?: number | null
}): Promise<PlatformActionResult> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('materials').insert({
    tenant_id: input.tenant_id,
    material_code: input.material_code.trim(),
    material_name: input.material_name.trim(),
    unit: input.unit.trim(),
    reorder_level: input.reorder_level ?? null,
    is_active: true,
    created_at: new Date().toISOString(),
    created_by: caller.userId,
  })
  if (error) return { ok: false, message: error.message, code: 'MATERIAL_CREATE_FAILED' }
  return { ok: true }
}

export async function createCustomer(input: {
  tenant_id: string
  customer_code: string
  customer_name: string
  company_name?: string | null
  mobile?: string | null
  gst_number?: string | null
  city?: string | null
  state?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  contact_designation?: string | null
  contact_role_type?: string | null
}): Promise<PlatformActionResult<{ customerId: string; partyId: string }>> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller
  const admin = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const customerCode = input.customer_code.trim()
  const customerName = input.customer_name.trim()
  if (!input.tenant_id || !customerCode || !customerName) {
    return { ok: false, message: 'Factory, customer code, and customer name are required.', code: 'VALIDATION_ERROR' }
  }

  const { data: party, error: partyError } = await admin
    .from('parties')
    .insert({
      tenant_id: input.tenant_id,
      party_code: customerCode,
      party_name: customerName,
      legal_name: input.company_name?.trim() || customerName,
      party_type: 'customer',
      gst_number: input.gst_number?.trim() || null,
      phone: input.mobile?.trim() || null,
      address: null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      is_active: true,
      created_at: now,
      created_by: caller.userId,
    })
    .select('id')
    .single()

  if (partyError || !party?.id) {
    return { ok: false, message: partyError?.message ?? 'Failed to create party.', code: 'PARTY_CREATE_FAILED' }
  }

  const { data: customer, error } = await admin.from('customers').insert({
    tenant_id: input.tenant_id,
    party_id: party.id,
    customer_code: customerCode,
    customer_name: customerName,
    company_name: input.company_name?.trim() || null,
    mobile: input.mobile?.trim() || null,
    gst_number: input.gst_number?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    is_active: true,
    created_at: now,
    created_by: caller.userId,
  }).select('id').single()

  if (error || !customer?.id) {
    await admin.from('parties').delete().eq('id', party.id)
    return { ok: false, message: error?.message ?? 'Failed to create customer.', code: 'CUSTOMER_CREATE_FAILED' }
  }

  const contactName = input.contact_name?.trim()
  if (contactName) {
    const contactResult = await createContactForParty({
      admin,
      callerUserId: caller.userId,
      tenantId: input.tenant_id,
      partyId: party.id,
      customerId: customer.id,
      vendorId: null,
      name: contactName,
      phone: input.contact_phone?.trim() || null,
      email: input.contact_email?.trim() || null,
      designation: input.contact_designation?.trim() || null,
      roleType: input.contact_role_type?.trim() || 'sales',
    })
    if (!contactResult.ok) return contactResult
  }

  return { ok: true, customerId: customer.id, partyId: party.id }
}

export async function createVendor(input: {
  tenant_id: string
  vendor_code: string
  vendor_name: string
  phone_number?: string | null
  gst_number?: string | null
  notes?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  contact_designation?: string | null
  contact_role_type?: string | null
}): Promise<PlatformActionResult<{ vendorId: string; partyId: string }>> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller
  const admin = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const vendorCode = input.vendor_code.trim()
  const vendorName = input.vendor_name.trim()
  if (!input.tenant_id || !vendorCode || !vendorName) {
    return { ok: false, message: 'Factory, vendor code, and vendor name are required.', code: 'VALIDATION_ERROR' }
  }

  const { data: party, error: partyError } = await admin
    .from('parties')
    .insert({
      tenant_id: input.tenant_id,
      party_code: vendorCode,
      party_name: vendorName,
      legal_name: vendorName,
      party_type: 'vendor',
      gst_number: input.gst_number?.trim() || null,
      phone: input.phone_number?.trim() || null,
      is_active: true,
      created_at: now,
      created_by: caller.userId,
    })
    .select('id')
    .single()

  if (partyError || !party?.id) {
    return { ok: false, message: partyError?.message ?? 'Failed to create party.', code: 'PARTY_CREATE_FAILED' }
  }

  const { data: vendor, error } = await admin.from('vendors').insert({
    tenant_id: input.tenant_id,
    party_id: party.id,
    vendor_code: vendorCode,
    vendor_name: vendorName,
    phone_number: input.phone_number?.trim() || null,
    gst_number: input.gst_number?.trim() || null,
    notes: input.notes?.trim() || null,
    is_active: true,
    created_at: now,
    created_by: caller.userId,
  }).select('id').single()

  if (error || !vendor?.id) {
    await admin.from('parties').delete().eq('id', party.id)
    return { ok: false, message: error?.message ?? 'Failed to create vendor.', code: 'VENDOR_CREATE_FAILED' }
  }

  const contactName = input.contact_name?.trim()
  if (contactName) {
    const contactResult = await createContactForParty({
      admin,
      callerUserId: caller.userId,
      tenantId: input.tenant_id,
      partyId: party.id,
      customerId: null,
      vendorId: vendor.id,
      name: contactName,
      phone: input.contact_phone?.trim() || null,
      email: input.contact_email?.trim() || null,
      designation: input.contact_designation?.trim() || null,
      roleType: input.contact_role_type?.trim() || 'procurement',
    })
    if (!contactResult.ok) return contactResult
  }

  return { ok: true, vendorId: vendor.id, partyId: party.id }
}

async function createContactForParty(input: {
  admin: ReturnType<typeof getSupabaseAdminClient>
  callerUserId: string
  tenantId: string
  partyId: string
  customerId: string | null
  vendorId: string | null
  name: string
  phone?: string | null
  email?: string | null
  designation?: string | null
  roleType: string
}): Promise<PlatformActionResult<{ contactId: string; contactRoleId: string }>> {
  const now = new Date().toISOString()
  const { data: contact, error: contactError } = await input.admin
    .from('contact_persons')
    .insert({
      tenant_id: input.tenantId,
      party_id: input.partyId,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      designation: input.designation || null,
      is_primary: true,
      is_active: true,
      created_at: now,
      created_by: input.callerUserId,
    })
    .select('id')
    .single()

  if (contactError || !contact?.id) {
    return { ok: false, message: contactError?.message ?? 'Failed to create contact.', code: 'CONTACT_CREATE_FAILED' }
  }

  const { data: contactRole, error: roleError } = await input.admin
    .from('contact_roles')
    .insert({
      tenant_id: input.tenantId,
      contact_person_id: contact.id,
      customer_id: input.customerId,
      vendor_id: input.vendorId,
      role_type: input.roleType,
      is_primary: true,
      created_at: now,
      created_by: input.callerUserId,
    })
    .select('id')
    .single()

  if (roleError || !contactRole?.id) {
    await input.admin.from('contact_persons').delete().eq('id', contact.id)
    return { ok: false, message: roleError?.message ?? 'Failed to assign contact role.', code: 'CONTACT_ROLE_CREATE_FAILED' }
  }

  return { ok: true, contactId: contact.id, contactRoleId: contactRole.id }
}

export async function createWarehouse(input: {
  tenant_id: string
  warehouse_code: string
  warehouse_name: string
  address?: string | null
  city?: string | null
  state?: string | null
  is_default: boolean
}): Promise<PlatformActionResult> {
  const caller = await requirePrivilegedRole()
  if (!caller.ok) return caller
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from('warehouses').insert({
    tenant_id: input.tenant_id,
    warehouse_code: input.warehouse_code.trim(),
    warehouse_name: input.warehouse_name.trim(),
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    is_default: input.is_default,
    is_active: true,
    created_at: new Date().toISOString(),
    created_by: caller.userId,
  })
  if (error) return { ok: false, message: error.message, code: 'WAREHOUSE_CREATE_FAILED' }
  return { ok: true }
}
