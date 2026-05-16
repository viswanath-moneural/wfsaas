'use server'

import { getEffectivePermissions, requireOrgAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, generateTempPassword, nowIso, ok, type AdminActionResult } from './_shared'
import { logMutation } from './auditLog'

function assertAccess(actor: any, orgId: string | null) {
  if (!actor.is_superadmin && orgId !== actor.org_id) throw new Error('Cannot access another organisation.')
}

export async function getAll(org_id?: string): Promise<AdminActionResult<any[]>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    let query = admin.from('users').select('*, role:roles(*), profile:profiles(*), businessUnit:business_units(*)').order('created_at', { ascending: false })
    if (org_id) query = query.eq('org_id', org_id)
    else if (!actor.is_superadmin) query = query.eq('org_id', actor.org_id ?? '')
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
    const orgFilter = actor.is_superadmin ? undefined : actor.org_id

    const [
      { data: organisations, error: orgError },
      { data: businessUnits, error: businessUnitError },
      { data: roles, error: roleError },
      { data: profiles, error: profileError },
      { data: permissionSets, error: setError },
    ] = await Promise.all([
      actor.is_superadmin
        ? admin.from('organisations').select('*').order('name')
        : admin.from('organisations').select('*').eq('id', actor.org_id ?? '').order('name'),
      orgFilter
        ? admin.from('business_units').select('*').eq('org_id', orgFilter).order('name')
        : admin.from('business_units').select('*').order('name'),
      orgFilter
        ? admin.from('roles').select('*').or(`org_id.eq.${orgFilter},org_id.is.null`).order('label')
        : admin.from('roles').select('*').order('label'),
      orgFilter
        ? admin.from('profiles').select('*').or(`org_id.eq.${orgFilter},org_id.is.null`).order('label')
        : admin.from('profiles').select('*').order('label'),
      orgFilter
        ? admin.from('permission_sets').select('*').eq('org_id', orgFilter).order('label')
        : admin.from('permission_sets').select('*').order('label'),
    ])

    if (orgError) throw orgError
    if (businessUnitError) throw businessUnitError
    if (roleError) throw roleError
    if (profileError) throw profileError
    if (setError) throw setError

    return ok({
      currentUser: actor,
      organisations: organisations ?? [],
      businessUnits: businessUnits ?? [],
      roles: roles ?? [],
      profiles: profiles ?? [],
      permissionSets: permissionSets ?? [],
    })
  } catch (error) {
    return fail(error)
  }
}

export async function getById(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data, error } = await admin.from('users').select('*, role:roles(*), profile:profiles(*), businessUnit:business_units(*)').eq('id', id).single()
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
    const { data: user, error } = await admin
      .from('users')
      .select('*, role:roles(*), profile:profiles(*), businessUnit:business_units(*), organisation:organisations(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    assertAccess(actor, user.org_id)

    const [
      { data: businessUnitAccess, error: accessError },
      { data: assignedSets, error: setError },
      { data: auditLog, error: auditError },
      lookups,
    ] = await Promise.all([
      admin.from('user_business_unit_access').select('*, business_units(*)').eq('user_id', id).order('created_at', { ascending: false }),
      admin.from('user_permission_sets').select('*, permission_sets(*)').eq('user_id', id).order('assigned_at', { ascending: false }),
      admin.from('audit_log').select('*').or(`actor_id.eq.${id},entity_id.eq.${id}`).order('created_at', { ascending: false }).limit(50),
      getLookups(),
    ])
    if (accessError) throw accessError
    if (setError) throw setError
    if (auditError) throw auditError

    const permissions = await getEffectivePermissions(id)

    return ok({
      user,
      businessUnitAccess: businessUnitAccess ?? [],
      assignedPermissionSets: assignedSets ?? [],
      permissions: Object.values(permissions),
      auditLog: auditLog ?? [],
      lookups: lookups.data ?? { organisations: [], businessUnits: [], roles: [], profiles: [], permissionSets: [] },
      currentUser: actor,
    })
  } catch (error) {
    return fail(error)
  }
}

export async function create(payload: {
  org_id: string
  business_unit_id?: string | null
  role_id?: string | null
  profile_id?: string | null
  first_name: string
  last_name?: string | null
  email: string
  phone?: string | null
  designation?: string | null
  department?: string | null
  password?: string
  business_unit_ids?: string[]
  is_active?: boolean
  password_reset_required?: boolean
}): Promise<AdminActionResult<any>> {
  let authUserId: string | null = null
  try {
    const actor = await requireOrgAdmin()
    assertAccess(actor, payload.org_id)
    const admin = createAdminClient()
    const password = payload.password || generateTempPassword()
    const timestamp = nowIso()
    const email = payload.email.trim().toLowerCase()

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${payload.first_name} ${payload.last_name ?? ''}`.trim() },
    })
    if (authError || !authUser.user) throw authError ?? new Error('Failed to create Auth user.')
    authUserId = authUser.user.id

    const { data, error } = await admin.from('users').insert({
      id: authUser.user.id,
      org_id: payload.org_id,
      business_unit_id: payload.business_unit_id ?? null,
      role_id: payload.role_id ?? null,
      profile_id: payload.profile_id ?? null,
      first_name: payload.first_name.trim(),
      last_name: payload.last_name ?? null,
      email,
      phone: payload.phone ?? null,
      designation: payload.designation ?? null,
      department: payload.department ?? null,
      is_active: payload.is_active ?? true,
      password_reset_required: payload.password_reset_required ?? true,
      created_at: timestamp,
      updated_at: timestamp,
    }).select('*').single()
    if (error) throw error

    const businessUnitIds = Array.from(new Set([payload.business_unit_id, ...(payload.business_unit_ids ?? [])].filter(Boolean))) as string[]
    if (businessUnitIds.length) {
      const { error: accessError } = await admin.from('user_business_unit_access').insert(businessUnitIds.map((businessUnitId) => ({
        user_id: data.id,
        business_unit_id: businessUnitId,
        is_default: businessUnitId === payload.business_unit_id,
        created_at: timestamp,
      })))
      if (accessError) throw accessError
    }

    await logMutation({ actor, org_id: data.org_id, action: 'user.create', entity_type: 'user', entity_id: data.id, entity_name: data.email, after: data })
    return ok({ user: data, temporaryPassword: password })
  } catch (error) {
    if (authUserId) await createAdminClient().auth.admin.deleteUser(authUserId)
    return fail(error)
  }
}

export async function update(id: string, payload: Record<string, any>): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('users').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertAccess(actor, before.org_id)
    const { data, error } = await admin.from('users').update({ ...payload, updated_at: nowIso() }).eq('id', id).select('*').single()
    if (error) throw error
    if (payload.email && payload.email !== before.email) await admin.auth.admin.updateUserById(id, { email: payload.email })
    await logMutation({ actor, org_id: data.org_id, action: 'user.update', entity_type: 'user', entity_id: id, entity_name: data.email, before, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function suspend(id: string): Promise<AdminActionResult<any>> {
  return update(id, { is_active: false })
}

export async function activate(id: string): Promise<AdminActionResult<any>> {
  return update(id, { is_active: true })
}

export async function deleteUser(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: before, error: beforeError } = await admin.from('users').select('*').eq('id', id).single()
    if (beforeError) throw beforeError
    assertAccess(actor, before.org_id)
    const { error: authError } = await admin.auth.admin.deleteUser(id)
    if (authError) throw authError
    await logMutation({ actor, org_id: before.org_id, action: 'user.delete', entity_type: 'user', entity_id: id, entity_name: before.email, before })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function resetPassword(id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: user, error: userError } = await admin.from('users').select('*').eq('id', id).single()
    if (userError) throw userError
    assertAccess(actor, user.org_id)
    const password = generateTempPassword()
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) throw error
    await admin.from('users').update({ password_reset_required: true, updated_at: nowIso() }).eq('id', id)
    await logMutation({ actor, org_id: user.org_id, action: 'user.reset_password', entity_type: 'user', entity_id: id, entity_name: user.email, before: { password_reset_required: user.password_reset_required }, after: { password_reset_required: true } })
    return ok({ id, temporaryPassword: password })
  } catch (error) {
    return fail(error)
  }
}

export async function assignPermissionSet(user_id: string, permission_set_id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: user, error: userError } = await admin.from('users').select('id, org_id').eq('id', user_id).single()
    if (userError) throw userError
    assertAccess(actor, user.org_id)
    const { data, error } = await admin.from('user_permission_sets').insert({ user_id, permission_set_id, assigned_by: actor.id, assigned_at: nowIso() }).select('*').single()
    if (error) throw error
    await logMutation({ actor, org_id: user.org_id, action: 'user.permission_set.assign', entity_type: 'user', entity_id: user_id, entity_name: user_id, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function removePermissionSet(user_id: string, permission_set_id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: user, error: userError } = await admin.from('users').select('id, org_id').eq('id', user_id).single()
    if (userError) throw userError
    assertAccess(actor, user.org_id)
    const { data: before } = await admin.from('user_permission_sets').select('*').eq('user_id', user_id).eq('permission_set_id', permission_set_id).maybeSingle()
    const { error } = await admin.from('user_permission_sets').delete().eq('user_id', user_id).eq('permission_set_id', permission_set_id)
    if (error) throw error
    await logMutation({ actor, org_id: user.org_id, action: 'user.permission_set.remove', entity_type: 'user', entity_id: user_id, entity_name: user_id, before })
    return ok({ user_id, permission_set_id })
  } catch (error) {
    return fail(error)
  }
}

export async function addBusinessUnitAccess(user_id: string, business_unit_id: string, is_default = false): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const [{ data: user, error: userError }, { data: businessUnit, error: businessUnitError }] = await Promise.all([
      admin.from('users').select('id, org_id').eq('id', user_id).single(),
      admin.from('business_units').select('*').eq('id', business_unit_id).single(),
    ])
    if (userError) throw userError
    if (businessUnitError) throw businessUnitError
    assertAccess(actor, user.org_id)
    if (user.org_id !== businessUnit.org_id) throw new Error('BusinessUnit must belong to the user organisation.')

    if (is_default) {
      await admin.from('user_business_unit_access').update({ is_default: false }).eq('user_id', user_id)
      await admin.from('users').update({ business_unit_id, updated_at: nowIso() }).eq('id', user_id)
    }

    const { data, error } = await admin
      .from('user_business_unit_access')
      .upsert({ user_id, business_unit_id, is_default, created_at: nowIso() }, { onConflict: 'user_id,business_unit_id' })
      .select('*, business_units(*)')
      .single()
    if (error) throw error
    await logMutation({ actor, org_id: user.org_id, action: 'user.businessUnit_access.add', entity_type: 'user', entity_id: user_id, entity_name: user_id, after: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function removeBusinessUnitAccess(user_id: string, business_unit_id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: user, error: userError } = await admin.from('users').select('id, org_id, business_unit_id').eq('id', user_id).single()
    if (userError) throw userError
    assertAccess(actor, user.org_id)
    const { data: before } = await admin.from('user_business_unit_access').select('*').eq('user_id', user_id).eq('business_unit_id', business_unit_id).maybeSingle()
    const { error } = await admin.from('user_business_unit_access').delete().eq('user_id', user_id).eq('business_unit_id', business_unit_id)
    if (error) throw error
    if (user.business_unit_id === business_unit_id) await admin.from('users').update({ business_unit_id: null, updated_at: nowIso() }).eq('id', user_id)
    await logMutation({ actor, org_id: user.org_id, action: 'user.businessUnit_access.remove', entity_type: 'user', entity_id: user_id, entity_name: user_id, before })
    return ok({ user_id, business_unit_id })
  } catch (error) {
    return fail(error)
  }
}

export async function setDefaultBusinessUnit(user_id: string, business_unit_id: string): Promise<AdminActionResult<any>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    const { data: user, error: userError } = await admin.from('users').select('*').eq('id', user_id).single()
    if (userError) throw userError
    assertAccess(actor, user.org_id)
    await admin.from('user_business_unit_access').update({ is_default: false }).eq('user_id', user_id)
    const { data, error } = await admin
      .from('user_business_unit_access')
      .upsert({ user_id, business_unit_id, is_default: true, created_at: nowIso() }, { onConflict: 'user_id,business_unit_id' })
      .select('*, business_units(*)')
      .single()
    if (error) throw error
    await admin.from('users').update({ business_unit_id, updated_at: nowIso() }).eq('id', user_id)
    await logMutation({ actor, org_id: user.org_id, action: 'user.businessUnit_access.default', entity_type: 'user', entity_id: user_id, entity_name: user.email, before: { business_unit_id: user.business_unit_id }, after: { business_unit_id } })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export { deleteUser as delete }










