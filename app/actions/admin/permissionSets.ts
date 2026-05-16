'use server'

import { requireOrgAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, type AdminActionResult } from './_shared'
import { logMutation } from './auditLog'

function assertAccess(actor: any, orgId: string | null) {
  if (!actor.is_superadmin && orgId !== actor.org_id) throw new Error('Cannot access another organisation.')
}

export async function getAll(org_id?: string): Promise<AdminActionResult<any[]>> {
  try {
    const actor = await requireOrgAdmin()
    let query = createAdminClient().from('permission_sets').select('*').order('created_at', { ascending: false })
    if (org_id) {
      assertAccess(actor, org_id)
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

export async function getLookups(): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const [
      { data: organisations, error: orgError },
      { data: modules, error: moduleError },
      { data: users, error: userError },
      { data: assignments, error: assignmentError },
    ] = await Promise.all([
      actor.is_superadmin
        ? admin.from('organisations').select('*').order('name')
        : admin.from('organisations').select('*').eq('id', actor.org_id ?? '').order('name'),
      admin.from('modules').select('*').eq('is_active', true).order('sort_order'),
      actor.is_superadmin
        ? admin.from('users').select('id, org_id, first_name, last_name, email, is_active').order('first_name')
        : admin.from('users').select('id, org_id, first_name, last_name, email, is_active').eq('org_id', actor.org_id ?? '').order('first_name'),
      actor.is_superadmin
        ? admin.from('user_permission_sets').select('id, user_id, permission_set_id')
        : admin.from('user_permission_sets').select('id, user_id, permission_set_id, users!inner(org_id)').eq('users.org_id', actor.org_id ?? ''),
    ])
    if (orgError) throw orgError
    if (moduleError) throw moduleError
    if (userError) throw userError
    if (assignmentError) throw assignmentError
    return ok({ currentUser: actor, organisations: organisations ?? [], modules: modules ?? [], users: users ?? [], assignments: assignments ?? [] })
  } catch (error) {
    return fail(error)
  }
}

export async function getById(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const { data, error } = await createAdminClient().from('permission_sets').select('*').eq('id', id).single()
    if (error) throw error
    assertAccess(actor, data.org_id)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function getDetail(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: permissionSet, error } = await admin.from('permission_sets').select('*').eq('id', id).single()
    if (error) throw error
    assertAccess(actor, permissionSet.org_id)

    const [
      permissionsResult,
      lookupsResult,
      { data: assignedUsers, error: assignedError },
    ] = await Promise.all([
      getPermissions(id),
      getLookups(),
      admin
        .from('user_permission_sets')
        .select('*, users(id, first_name, last_name, email, is_active, role:roles(label), profile:profiles(label))')
        .eq('permission_set_id', id)
        .order('assigned_at', { ascending: false }),
    ])

    if (permissionsResult.error) throw new Error(permissionsResult.error)
    if (lookupsResult.error) throw new Error(lookupsResult.error)
    if (assignedError) throw assignedError

    return ok({
      permissionSet,
      permissions: permissionsResult.data ?? [],
      assignedUsers: assignedUsers ?? [],
      lookups: lookupsResult.data ?? { currentUser: actor, organisations: [], modules: [], users: [], assignments: [] },
    })
  } catch (error) {
    return fail(error)
  }
}

export async function create(payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    assertAccess(actor, payload.org_id)
    const admin = createAdminClient()
    const { data, error } = await admin.from('permission_sets').insert({ ...payload, created_at: nowIso(), updated_at: nowIso() }).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'permission_set.create', entity_type: 'permission_set', entity_id: data.id, entity_name: data.name, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('permission_sets').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertAccess(actor, before.org_id)
    const { data, error } = await admin.from('permission_sets').update({ ...payload, updated_at: nowIso() }).eq('id', id).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: data.org_id, action: 'permission_set.update', entity_type: 'permission_set', entity_id: id, entity_name: data.name, before, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deletePermissionSet(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('permission_sets').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertAccess(actor, before.org_id)
    const { error } = await admin.from('permission_sets').delete().eq('id', id)
    if (error) throw error
    await logMutation({ actor, org_id: before.org_id, action: 'permission_set.delete', entity_type: 'permission_set', entity_id: id, entity_name: before.name, before })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function getPermissions(permission_set_id: string): Promise<AdminActionResult<any[]>> {
  try {
    await requireOrgAdmin()
    const { data, error } = await createAdminClient().from('permission_set_permissions').select('*, modules(*)').eq('permission_set_id', permission_set_id)
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function updatePermissions(permission_set_id: string, permissions: any[]): Promise<AdminActionResult<any[]>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: permissionSet, error: setError } = await admin.from('permission_sets').select('*').eq('id', permission_set_id).single()
    if (setError) throw setError
    assertAccess(actor, permissionSet.org_id)
    const { data: before } = await admin.from('permission_set_permissions').select('*').eq('permission_set_id', permission_set_id)
    const payload = permissions.map((permission) => ({ ...permission, permission_set_id }))
    const { data, error } = await admin.from('permission_set_permissions').upsert(payload, { onConflict: 'permission_set_id,module_id' }).select('*')
    if (error) throw error
    await logMutation({ actor, org_id: permissionSet.org_id, action: 'permission_set.permissions.update', entity_type: 'permission_set', entity_id: permission_set_id, entity_name: permissionSet.name, before, after: data })
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function assignUser(permission_set_id: string, user_id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const [{ data: permissionSet, error: setError }, { data: user, error: userError }] = await Promise.all([
      admin.from('permission_sets').select('*').eq('id', permission_set_id).single(),
      admin.from('users').select('id, org_id, email').eq('id', user_id).single(),
    ])
    if (setError) throw setError
    if (userError) throw userError
    assertAccess(actor, permissionSet.org_id)
    if (permissionSet.org_id !== user.org_id) throw new Error('User must belong to the permission set organisation.')
    const { data, error } = await admin
      .from('user_permission_sets')
      .upsert({ permission_set_id, user_id, assigned_by: actor.id, assigned_at: nowIso() }, { onConflict: 'user_id,permission_set_id' })
      .select('*')
      .single()
    if (error) throw error
    await logMutation({ actor, org_id: permissionSet.org_id, action: 'permission_set.user.assign', entity_type: 'permission_set', entity_id: permission_set_id, entity_name: permissionSet.name, after: { user_id, permission_set_id } })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function removeUser(permission_set_id: string, user_id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: permissionSet, error: setError } = await admin.from('permission_sets').select('*').eq('id', permission_set_id).single()
    if (setError) throw setError
    assertAccess(actor, permissionSet.org_id)
    const { data: before } = await admin.from('user_permission_sets').select('*').eq('permission_set_id', permission_set_id).eq('user_id', user_id).maybeSingle()
    const { error } = await admin.from('user_permission_sets').delete().eq('permission_set_id', permission_set_id).eq('user_id', user_id)
    if (error) throw error
    await logMutation({ actor, org_id: permissionSet.org_id, action: 'permission_set.user.remove', entity_type: 'permission_set', entity_id: permission_set_id, entity_name: permissionSet.name, before })
    return ok({ permission_set_id, user_id })
  } catch (error) {
    return fail(error)
  }
}

export { deletePermissionSet as delete }





