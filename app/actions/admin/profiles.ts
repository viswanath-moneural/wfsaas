'use server'

import { requireOrgAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, type AdminActionResult } from './_shared'
import { logMutation } from './auditLog'

function canAccess(actor: any, orgId: string | null) {
  if (actor.is_superadmin) return true
  return orgId === null || orgId === actor.org_id
}

export async function getAll(org_id?: string): Promise<AdminActionResult<any[]>> {
  try {
    const actor = await requireOrgAdmin()
    let query = createAdminClient().from('profiles').select('*').order('created_at', { ascending: false })
    if (org_id) query = query.eq('org_id', org_id)
    else if (!actor.is_superadmin) query = query.or(`org_id.eq.${actor.org_id},org_id.is.null`)
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
      { data: modules, error: moduleError },
    ] = await Promise.all([
      actor.is_superadmin
        ? admin.from('organisations').select('*').order('name')
        : admin.from('organisations').select('*').eq('id', actor.org_id ?? '').order('name'),
      admin.from('modules').select('*').eq('is_active', true).order('sort_order'),
    ])
    if (orgError) throw orgError
    if (moduleError) throw moduleError
    return ok({ currentUser: actor, organisations: organisations ?? [], modules: modules ?? [] })
  } catch (error) {
    return fail(error)
  }
}

export async function getById(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const { data, error } = await createAdminClient().from('profiles').select('*').eq('id', id).single()
    if (error) throw error
    if (!canAccess(actor, data.org_id)) throw new Error('Cannot access profile for another organisation.')
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function getDetail(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: profile, error } = await admin.from('profiles').select('*').eq('id', id).single()
    if (error) throw error
    if (!canAccess(actor, profile.org_id)) throw new Error('Cannot access profile for another organisation.')

    const [
      permissionsResult,
      lookupsResult,
      { count: usersCount, error: countError },
    ] = await Promise.all([
      getPermissions(id),
      getLookups(),
      admin.from('users').select('id', { count: 'exact', head: true }).eq('profile_id', id),
    ])

    if (permissionsResult.error) throw new Error(permissionsResult.error)
    if (lookupsResult.error) throw new Error(lookupsResult.error)
    if (countError) throw countError

    return ok({
      profile,
      permissions: permissionsResult.data ?? [],
      usersCount: usersCount ?? 0,
      lookups: lookupsResult.data ?? { currentUser: actor, organisations: [], modules: [] },
    })
  } catch (error) {
    return fail(error)
  }
}

export async function create(payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    if (!canAccess(actor, payload.org_id ?? null)) throw new Error('Cannot create profile for another organisation.')
    const admin = createAdminClient()
    const { data, error } = await admin.from('profiles').insert({ ...payload, created_at: nowIso(), updated_at: nowIso() }).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'profile.create', entity_type: 'profile', entity_id: data.id, entity_name: data.name, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function clone(id: string, new_name: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: source, error: sourceError } = await admin.from('profiles').select('*').eq('id', id).single()
    if (sourceError) throw sourceError
    if (!canAccess(actor, source.org_id)) throw new Error('Cannot clone profile for another organisation.')
    const { data: cloned, error: cloneError } = await admin.from('profiles').insert({
      org_id: source.org_id,
      name: new_name.trim().toLowerCase().replace(/\s+/g, '_'),
      label: new_name.trim(),
      description: source.description,
      is_system: false,
      cloned_from_id: id,
      created_at: nowIso(),
      updated_at: nowIso(),
    }).select('*').single()
    if (cloneError) throw cloneError

    const { data: permissions, error: permError } = await admin.from('profile_permissions').select('*').eq('profile_id', id)
    if (permError) throw permError
    if (permissions?.length) {
      const { error } = await admin.from('profile_permissions').insert(permissions.map((permission: any) => ({
        profile_id: cloned.id,
        module_id: permission.module_id,
        can_view: permission.can_view,
        can_create: permission.can_create,
        can_edit: permission.can_edit,
        can_delete: permission.can_delete,
        can_export: permission.can_export,
        can_approve: permission.can_approve,
        created_at: nowIso(),
        updated_at: nowIso(),
      })))
      if (error) throw error
    }

    await logMutation({ actor, org_id: cloned.org_id, action: 'profile.clone', entity_type: 'profile', entity_id: cloned.id, entity_name: cloned.name, before: source, after: cloned })
    return ok(cloned)
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('profiles').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    if (!canAccess(actor, before.org_id)) throw new Error('Cannot update profile for another organisation.')
    const { data, error } = await admin.from('profiles').update({ ...payload, updated_at: nowIso() }).eq('id', id).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'profile.update', entity_type: 'profile', entity_id: id, entity_name: data.name, before, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteProfile(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('profiles').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    if (before.is_system) throw new Error('System profiles cannot be deleted.')
    if (!canAccess(actor, before.org_id)) throw new Error('Cannot delete profile for another organisation.')
    const { error } = await admin.from('profiles').delete().eq('id', id)
    if (error) throw error
    await logMutation({ actor, org_id: before.org_id, action: 'profile.delete', entity_type: 'profile', entity_id: id, entity_name: before.name, before })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function getPermissions(profile_id: string): Promise<AdminActionResult<any[]>> {
  try {
    await requireOrgAdmin()
    const { data, error } = await createAdminClient().from('profile_permissions').select('*, modules(*)').eq('profile_id', profile_id).order('created_at')
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function updatePermissions(profile_id: string, permissions: any[]): Promise<AdminActionResult<any[]>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin.from('profiles').select('*').eq('id', profile_id).single()
    if (profileError) throw profileError
    if (!canAccess(actor, profile.org_id)) throw new Error('Cannot update profile permissions for another organisation.')
    const { data: before } = await admin.from('profile_permissions').select('*').eq('profile_id', profile_id)
    const payload = permissions.map((permission) => ({ ...permission, profile_id, updated_at: nowIso() }))
    const { data, error } = await admin.from('profile_permissions').upsert(payload, { onConflict: 'profile_id,module_id' }).select('*')
    if (error) throw error
    await logMutation({ actor, org_id: profile.org_id, action: 'profile.permissions.update', entity_type: 'profile', entity_id: profile_id, entity_name: profile.name, before, after: data })
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export { deleteProfile as delete }





