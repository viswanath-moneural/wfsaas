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
    const { data, error } = await createAdminClient().from('factories').select('*').eq('org_id', org_id).order('created_at', { ascending: false })
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function getById(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const { data, error } = await createAdminClient().from('factories').select('*').eq('id', id).single()
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
    const { data, error } = await admin.from('factories').insert({ ...payload, created_at: nowIso(), updated_at: nowIso() }).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'factory.create', entity_type: 'factory', entity_id: data.id, entity_name: data.name, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('factories').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertOrgAccess(actor, before.org_id)
    const { data, error } = await admin.from('factories').update({ ...payload, updated_at: nowIso() }).eq('id', id).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'factory.update', entity_type: 'factory', entity_id: id, entity_name: data.name, before, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function setDefault(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: factory, error: lookupError } = await admin.from('factories').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    assertOrgAccess(actor, factory.org_id)
    await admin.from('factories').update({ is_default: false, updated_at: nowIso() }).eq('org_id', factory.org_id)
    const { data, error } = await admin.from('factories').update({ is_default: true, updated_at: nowIso() }).eq('id', id).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'factory.set_default', entity_type: 'factory', entity_id: id, entity_name: data.name, before: factory, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteFactory(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('factories').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertOrgAccess(actor, before.org_id)
    const { error } = await admin.from('factories').delete().eq('id', id)
    if (error) throw error
    await logMutation({ actor, org_id: before.org_id, action: 'factory.delete', entity_type: 'factory', entity_id: id, entity_name: before.name, before })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export { deleteFactory as delete }
