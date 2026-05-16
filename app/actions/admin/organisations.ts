'use server'

import { requireOrgAdmin, requireSuperadmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, generateTempPassword, nowIso, ok, type AdminActionResult } from './_shared'
import { logMutation } from './auditLog'

export async function getAll(): Promise<AdminActionResult<any[]>> {
  try {
    await requireSuperadmin()
    const admin = createAdminClient()
    const { data, error } = await admin.from('organisations').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function getById(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    let query = admin.from('organisations').select('*').eq('id', id)
    if (!actor.is_superadmin) query = query.eq('id', actor.org_id ?? '')
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function create(payload: {
  name: string
  slug: string
  plan?: 'free' | 'pro' | 'enterprise'
  country?: string | null
  timezone?: string | null
  currency?: string | null
  fiscal_year_start?: number | null
  businessUnit?: { name?: string; code?: string; address?: string | null; city?: string | null; state?: string | null; country?: string | null; pincode?: string | null; gstin?: string | null; pan?: string | null }
  owner: { email: string; password?: string; first_name: string; last_name?: string | null; phone?: string | null }
}): Promise<AdminActionResult<any>> {
  const created: { orgId?: string; businessUnitId?: string; authUserId?: string } = {}
  try {
    const actor = await requireSuperadmin()
    const admin = createAdminClient()
    const timestamp = nowIso()
    const password = payload.owner.password || generateTempPassword()

    const { data: org, error: orgError } = await admin.from('organisations').insert({
      name: payload.name.trim(),
      slug: payload.slug.trim().toLowerCase(),
      plan: payload.plan ?? 'free',
      country: payload.country ?? null,
      timezone: payload.timezone ?? 'UTC',
      currency: payload.currency ?? 'INR',
      fiscal_year_start: payload.fiscal_year_start ?? 4,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    }).select('*').single()
    if (orgError) throw orgError
    created.orgId = org.id

    const { data: businessUnit, error: businessUnitError } = await admin.from('business_units').insert({
      org_id: org.id,
      name: payload.businessUnit?.name?.trim() || `${payload.name.trim()} Default BusinessUnit`,
      code: payload.businessUnit?.code?.trim() || 'DEFAULT',
      address: payload.businessUnit?.address ?? null,
      city: payload.businessUnit?.city ?? null,
      state: payload.businessUnit?.state ?? null,
      country: payload.businessUnit?.country ?? payload.country ?? null,
      pincode: payload.businessUnit?.pincode ?? null,
      gstin: payload.businessUnit?.gstin ?? null,
      pan: payload.businessUnit?.pan ?? null,
      is_active: true,
      is_default: true,
      created_at: timestamp,
      updated_at: timestamp,
    }).select('*').single()
    if (businessUnitError) throw businessUnitError
    created.businessUnitId = businessUnit.id

    const [{ data: ownerRole }, { data: adminProfile }] = await Promise.all([
      admin.from('roles').select('id').eq('name', 'owner').is('org_id', null).single(),
      admin.from('profiles').select('id').eq('name', 'system_admin').is('org_id', null).single(),
    ])

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: payload.owner.email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: `${payload.owner.first_name} ${payload.owner.last_name ?? ''}`.trim() },
    })
    if (authError || !authUser.user) throw authError ?? new Error('Failed to create owner Auth user.')
    created.authUserId = authUser.user.id

    const { data: ownerUser, error: userError } = await admin.from('users').insert({
      id: authUser.user.id,
      org_id: org.id,
      business_unit_id: businessUnit.id,
      role_id: ownerRole?.id,
      profile_id: adminProfile?.id,
      first_name: payload.owner.first_name.trim(),
      last_name: payload.owner.last_name ?? null,
      email: payload.owner.email.trim().toLowerCase(),
      phone: payload.owner.phone ?? null,
      is_active: true,
      password_reset_required: true,
      created_at: timestamp,
      updated_at: timestamp,
    }).select('*').single()
    if (userError) throw userError

    const { error: accessError } = await admin.from('user_business_unit_access').insert({
      user_id: ownerUser.id,
      business_unit_id: businessUnit.id,
      is_default: true,
      created_at: timestamp,
    })
    if (accessError) throw accessError

    const { data: modules } = await admin.from('modules').select('id')
    if (modules?.length) {
      const { error: moduleError } = await admin.from('org_modules').insert(modules.map((moduleRow: any) => ({
        org_id: org.id,
        module_id: moduleRow.id,
        is_enabled: true,
        enabled_at: timestamp,
      })))
      if (moduleError) throw moduleError
    }

    await logMutation({ actor, org_id: org.id, action: 'organisation.create', entity_type: 'organisation', entity_id: org.id, entity_name: org.name, after: { org, businessUnit, ownerUser } })
    return ok({ organisation: org, businessUnit, ownerUser, temporaryPassword: password })
  } catch (error) {
    const admin = createAdminClient()
    if (created.authUserId) await admin.auth.admin.deleteUser(created.authUserId)
    if (created.orgId) await admin.from('organisations').delete().eq('id', created.orgId)
    return fail(error)
  }
}

export async function update(id: string, payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('organisations').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    if (!actor.is_superadmin && actor.org_id !== id) throw new Error('Cannot update another organisation.')
    const { data, error } = await admin.from('organisations').update({ ...payload, updated_at: nowIso() }).eq('id', id).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: id, action: 'organisation.update', entity_type: 'organisation', entity_id: id, entity_name: data.name, before, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function suspend(id: string, note: string): Promise<AdminActionResult<any>> {
  return update(id, { is_active: false, suspended_at: nowIso(), suspension_note: note })
}

export async function activate(id: string): Promise<AdminActionResult<any>> {
  return update(id, { is_active: true, suspended_at: null, suspension_note: null })
}

export async function deleteOrganisation(id: string): Promise<AdminActionResult<any>> {
  return update(id, { is_active: false, suspended_at: nowIso(), suspension_note: 'Soft deleted' })
}

export { deleteOrganisation as delete }










