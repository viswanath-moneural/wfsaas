'use server'

import { requireOrgAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, type AdminActionResult } from './_shared'
import { logMutation } from './auditLog'

function assertOrgAccess(actor: any, orgId: string) {
  if (!actor.is_superadmin && actor.org_id !== orgId) throw new Error('Cannot access another organisation.')
}

export async function getByOrg(org_id: string): Promise<AdminActionResult<any[]>> {
  try {
    const actor = await requireOrgAdmin()
    assertOrgAccess(actor, org_id)
    const { data, error } = await createAdminClient().from('business_units').select('*').eq('org_id', org_id).order('created_at', { ascending: false })
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function getLookups(): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: organisations, error } = actor.is_superadmin
      ? await admin.from('organisations').select('*').order('name')
      : await admin.from('organisations').select('*').eq('id', actor.org_id ?? '').order('name')
    if (error) throw error
    return ok({ currentUser: actor, organisations: organisations ?? [] })
  } catch (error) {
    return fail(error)
  }
}

export async function getAll(org_id?: string): Promise<AdminActionResult<any[]>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    let query = admin.from('business_units').select('*, organisation:organisations(*)').order('created_at', { ascending: false })
    if (org_id) {
      assertOrgAccess(actor, org_id)
      query = query.eq('org_id', org_id)
    } else if (!actor.is_superadmin) {
      query = query.eq('org_id', actor.org_id ?? '')
    }
    const { data, error } = await query
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function getById(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const { data, error } = await createAdminClient().from('business_units').select('*').eq('id', id).single()
    if (error) throw error
    assertOrgAccess(actor, data.org_id)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function create(payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    assertOrgAccess(actor, payload.org_id)
    const admin = createAdminClient()
    if (payload.is_default === true) {
      const { error: defaultError } = await admin.from('business_units').update({ is_default: false, updated_at: nowIso() }).eq('org_id', payload.org_id)
      if (defaultError) throw defaultError
    }
    const { data, error } = await admin.from('business_units').insert({ ...payload, created_at: nowIso(), updated_at: nowIso() }).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'business_unit.create', entity_type: 'business_unit', entity_id: data.id, entity_name: data.name, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('business_units').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertOrgAccess(actor, before.org_id)
    if (payload.is_default === true) {
      const { error: defaultError } = await admin.from('business_units').update({ is_default: false, updated_at: nowIso() }).eq('org_id', before.org_id).neq('id', id)
      if (defaultError) throw defaultError
    }
    const { data, error } = await admin.from('business_units').update({ ...payload, updated_at: nowIso() }).eq('id', id).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'business_unit.update', entity_type: 'business_unit', entity_id: id, entity_name: data.name, before, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function setDefault(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: businessUnit, error: lookupError } = await admin.from('business_units').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    assertOrgAccess(actor, businessUnit.org_id)
    await admin.from('business_units').update({ is_default: false, updated_at: nowIso() }).eq('org_id', businessUnit.org_id)
    const { data, error } = await admin.from('business_units').update({ is_default: true, updated_at: nowIso() }).eq('id', id).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'business_unit.set_default', entity_type: 'business_unit', entity_id: id, entity_name: data.name, before: businessUnit, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteBusinessUnit(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('business_units').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertOrgAccess(actor, before.org_id)
    const { error } = await admin.from('business_units').delete().eq('id', id)
    if (error) throw error
    await logMutation({ actor, org_id: before.org_id, action: 'business_unit.delete', entity_type: 'business_unit', entity_id: id, entity_name: before.name, before })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export { deleteBusinessUnit as delete }










