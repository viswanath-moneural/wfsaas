'use server'

import { requireOrgAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, type AdminActionResult } from './_shared'
import { logMutation } from './auditLog'

function scoped(query: any, actor: any, orgId?: string) {
  if (orgId) return query.eq('org_id', orgId)
  if (!actor.is_superadmin) return query.or(`org_id.eq.${actor.org_id},org_id.is.null`)
  return query
}

export async function getAll(org_id?: string): Promise<AdminActionResult<any[]>> {
  try {
    const actor = await requireOrgAdmin()
    const query = scoped(createAdminClient().from('roles').select('*').order('created_at', { ascending: false }), actor, org_id)
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
      { data: users, error: userError },
    ] = await Promise.all([
      actor.is_superadmin
        ? admin.from('organisations').select('*').order('name')
        : admin.from('organisations').select('*').eq('id', actor.org_id ?? '').order('name'),
      actor.is_superadmin
        ? admin.from('users').select('id, role_id, org_id')
        : admin.from('users').select('id, role_id, org_id').eq('org_id', actor.org_id ?? ''),
    ])
    if (orgError) throw orgError
    if (userError) throw userError
    return ok({ currentUser: actor, organisations: organisations ?? [], users: users ?? [] })
  } catch (error) {
    return fail(error)
  }
}

export async function getById(id: string): Promise<AdminActionResult<any>> {
  try {
    await requireOrgAdmin()
    const { data, error } = await createAdminClient().from('roles').select('*').eq('id', id).single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function create(payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    if (!actor.is_superadmin && payload.org_id !== actor.org_id) throw new Error('Cannot create role for another organisation.')
    const admin = createAdminClient()
    const { data, error } = await admin.from('roles').insert({ ...payload, created_at: nowIso(), updated_at: nowIso() }).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'role.create', entity_type: 'role', entity_id: data.id, entity_name: data.name, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('roles').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    if (!actor.is_superadmin && before.org_id !== actor.org_id) throw new Error('Cannot update role for another organisation.')
    if (before.is_system && payload.name && payload.name !== before.name) throw new Error('System role names cannot be changed.')
    const { data, error } = await admin.from('roles').update({ ...payload, updated_at: nowIso() }).eq('id', id).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'role.update', entity_type: 'role', entity_id: id, entity_name: data.name, before, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteRole(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('roles').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    if (before.is_system) throw new Error('System roles cannot be deleted.')
    if (!actor.is_superadmin && before.org_id !== actor.org_id) throw new Error('Cannot delete role for another organisation.')
    const { count, error: countError } = await admin.from('users').select('id', { count: 'exact', head: true }).eq('role_id', id)
    if (countError) throw countError
    if ((count ?? 0) > 0) throw new Error('Cannot delete a role while users are assigned to it.')
    const { error } = await admin.from('roles').delete().eq('id', id)
    if (error) throw error
    await logMutation({ actor, org_id: before.org_id, action: 'role.delete', entity_type: 'role', entity_id: id, entity_name: before.name, before })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export { deleteRole as delete }
