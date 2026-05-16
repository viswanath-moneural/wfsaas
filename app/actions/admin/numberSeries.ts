'use server'

import { requireOrgAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, type AdminActionResult } from './_shared'
import { logMutation } from './auditLog'

function assertAccess(actor: any, orgId: string) {
  if (!actor.is_superadmin && orgId !== actor.org_id) throw new Error('Cannot access another organisation.')
}

export async function getAll(org_id?: string, business_unit_id?: string): Promise<AdminActionResult<any[]>> {
  try {
    const actor = await requireOrgAdmin()
    const effectiveOrgId = org_id ?? actor.org_id
    if (!effectiveOrgId) throw new Error('Organisation context is required.')
    assertAccess(actor, effectiveOrgId)
    let query = createAdminClient().from('number_series').select('*, businessUnit:business_units(*)').eq('org_id', effectiveOrgId).order('module_key').order('document_type')
    if (business_unit_id) query = query.eq('business_unit_id', business_unit_id)
    const { data, error } = await query
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
    const [
      { data: organisations, error: orgError },
      { data: businessUnits, error: businessUnitError },
    ] = await Promise.all([
      actor.is_superadmin
        ? admin.from('organisations').select('*').order('name')
        : admin.from('organisations').select('*').eq('id', actor.org_id ?? '').order('name'),
      actor.is_superadmin
        ? admin.from('business_units').select('*').order('name')
        : admin.from('business_units').select('*').eq('org_id', actor.org_id ?? '').order('name'),
    ])
    if (orgError) throw orgError
    if (businessUnitError) throw businessUnitError
    return ok({ currentUser: actor, organisations: organisations ?? [], businessUnits: businessUnits ?? [] })
  } catch (error) {
    return fail(error)
  }
}

export async function getById(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const { data, error } = await createAdminClient().from('number_series').select('*').eq('id', id).single()
    if (error) throw error
    assertAccess(actor, data.org_id)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function create(payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    assertAccess(actor, payload.org_id)
    const admin = createAdminClient()
    const { data, error } = await admin.from('number_series').insert({ ...payload, created_at: nowIso(), updated_at: nowIso() }).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'number_series.create', entity_type: 'number_series', entity_id: data.id, entity_name: data.document_type, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('number_series').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertAccess(actor, before.org_id)
    const { data, error } = await admin.from('number_series').update({ ...payload, updated_at: nowIso() }).eq('id', id).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'number_series.update', entity_type: 'number_series', entity_id: id, entity_name: data.document_type, before, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteNumberSeries(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('number_series').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertAccess(actor, before.org_id)
    const { error } = await admin.from('number_series').delete().eq('id', id)
    if (error) throw error
    await logMutation({ actor, org_id: before.org_id, action: 'number_series.delete', entity_type: 'number_series', entity_id: id, entity_name: before.document_type, before })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function getNextNumber(series_id: string): Promise<AdminActionResult<string>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: series, error: seriesError } = await admin.from('number_series').select('*').eq('id', series_id).single()
    if (seriesError) throw seriesError
    assertAccess(actor, series.org_id)
    const { data, error } = await admin.rpc('get_next_number', { p_series_id: series_id })
    if (error) throw error
    await logMutation({ actor, org_id: series.org_id, action: 'number_series.next', entity_type: 'number_series', entity_id: series_id, entity_name: series.document_type, before: series, after: { generated_number: data } })
    return ok(data as string)
  } catch (error) {
    return fail(error)
  }
}

export async function resetSeries(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('number_series').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertAccess(actor, before.org_id)
    const { data, error } = await admin
      .from('number_series')
      .update({ current_value: before.start_value ?? 1, last_reset_at: nowIso(), updated_at: nowIso() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'number_series.reset', entity_type: 'number_series', entity_id: id, entity_name: data.document_type, before, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export { deleteNumberSeries as delete }








