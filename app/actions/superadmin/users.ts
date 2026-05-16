'use server'

import { getSuperadminContext } from '@/lib/auth/getSuperadminContext'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, trimOrNull, writeAuditLog, type SuperadminActionResult } from './_shared'

export async function listAll(orgId?: string): Promise<SuperadminActionResult<any[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    let query = admin.from('users').select('*, organisations(name, slug), business_units(name), user_roles(role_id, roles(role_name))').order('created_at', { ascending: false })
    if (orgId) query = query.eq('org_id', orgId)
    const [{ data, error }, { data: authUsers }] = await Promise.all([
      query,
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])
    if (error) throw error
    const authById = new Map((authUsers?.users ?? []).map((user: any) => [user.id, user]))
    return ok((data ?? []).map((user: any) => ({
      ...user,
      auth_user: authById.get(user.id) ?? null,
      last_login: authById.get(user.id)?.last_sign_in_at ?? null,
    })))
  } catch (error) {
    return fail(error)
  }
}

export async function getManagementLookups(): Promise<SuperadminActionResult<{
  organisations: any[]
  businessUnits: any[]
  roles: any[]
}>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const [{ data: organisations, error: orgError }, { data: businessUnits, error: businessUnitError }, { data: roles, error: roleError }] = await Promise.all([
      admin.from('organisations').select('id, name, slug, is_active').order('name'),
      admin.from('business_units').select('id, name, org_id, is_active').order('name'),
      admin.from('roles').select('id, org_id, role_name, description, is_system').order('role_name'),
    ])
    if (orgError) throw orgError
    if (businessUnitError) throw businessUnitError
    if (roleError) throw roleError
    return ok({ organisations: organisations ?? [], businessUnits: businessUnits ?? [], roles: roles ?? [] })
  } catch (error) {
    return fail(error)
  }
}

export async function create(input: {
  email: string
  password: string
  full_name: string
  org_id: string
  business_unit_id?: string | null
  role_id: string
  phone?: string | null
  is_active?: boolean
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const email = input.email.trim().toLowerCase()
    const timestamp = nowIso()

    if (!email || !input.password || !input.full_name.trim() || !input.org_id || !input.role_id) {
      throw new Error('Email, password, name, organisation, and role are required.')
    }

    const { data: role, error: roleError } = await admin
      .from('roles')
      .select('id, role_name, org_id')
      .eq('id', input.role_id)
      .single()
    if (roleError) throw roleError
    if (role.org_id !== input.org_id) throw new Error('Selected role does not belong to the selected organisation.')

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name.trim() },
    })
    if (authError || !authData.user) throw authError ?? new Error('Supabase Auth user was not created.')

    try {
      const { data: appUser, error: appUserError } = await admin
        .from('users')
        .insert({
          id: authData.user.id,
          org_id: input.org_id,
          business_unit_id: input.business_unit_id || null,
          full_name: input.full_name.trim(),
          phone: trimOrNull(input.phone) ?? '0000000000',
          role: role.role_name,
          is_active: input.is_active ?? true,
          email,
          created_at: timestamp,
          updated_at: timestamp,
          created_by: verified.userId,
        })
        .select('*')
        .single()
      if (appUserError) throw appUserError

      const { error: assignError } = await admin.from('user_roles').insert({
        user_id: authData.user.id,
        role_id: input.role_id,
        assigned_by: verified.userId,
        assigned_at: timestamp,
        is_active: true,
        created_at: timestamp,
        created_by: verified.userId,
      })
      if (assignError) throw assignError

      await writeAuditLog({ admin, actor: verified, orgId: input.org_id, tableName: 'users', recordId: authData.user.id, action: 'create', newData: appUser })
      return ok({ ...appUser, temporaryPassword: input.password })
    } catch (error) {
      await admin.auth.admin.deleteUser(authData.user.id)
      throw error
    }
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, input: {
  full_name?: string
  phone?: string | null
  email?: string
  org_id?: string
  business_unit_id?: string | null
  role?: string
  is_active?: boolean
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('users').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    const payload = {
      ...(input.full_name !== undefined ? { full_name: input.full_name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: trimOrNull(input.phone) ?? '0000000000' } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.org_id !== undefined ? { org_id: input.org_id } : {}),
      ...(input.business_unit_id !== undefined ? { business_unit_id: input.business_unit_id || null } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      updated_at: nowIso(),
      last_modified_at: nowIso(),
      last_modified_by: verified.userId,
    }
    const { data, error } = await admin.from('users').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    if (input.email !== undefined) await admin.auth.admin.updateUserById(id, { email: input.email.trim().toLowerCase() })
    await writeAuditLog({ admin, actor: verified, orgId: data.org_id, tableName: 'users', recordId: id, action: 'update', oldData, newData: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteUser(id: string): Promise<SuperadminActionResult<{ id: string }>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('users').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    const { error: roleError } = await admin.from('user_roles').delete().eq('user_id', id)
    if (roleError) throw roleError
    const { error: appError } = await admin.from('users').delete().eq('id', id)
    if (appError) throw appError
    const { error: authError } = await admin.auth.admin.deleteUser(id)
    if (authError) throw authError
    await writeAuditLog({ admin, actor: verified, orgId: oldData.org_id, tableName: 'users', recordId: id, action: 'delete', oldData })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

function generatePassword() {
  const token = globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 12) ?? Math.random().toString(36).slice(2, 14)
  return `Wf@${token}`
}

export async function resetPassword(id: string, password: string): Promise<SuperadminActionResult<{ id: string }>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    if (!password) throw new Error('New password is required.')
    const { data: userRow, error: lookupError } = await admin.from('users').select('id, org_id, email').eq('id', id).single()
    if (lookupError) throw lookupError
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: userRow.org_id, tableName: 'users', recordId: id, action: 'reset_password', newData: { email: userRow.email } })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function resetPasswordGenerated(id: string): Promise<SuperadminActionResult<{ id: string; password: string }>> {
  try {
    const password = generatePassword()
    const result = await resetPassword(id, password)
    if (result.error) throw new Error(result.error)
    return ok({ id, password })
  } catch (error) {
    return fail(error)
  }
}

export async function impersonate(id: string): Promise<SuperadminActionResult<{ userId: string; actionLink: string }>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: userRow, error: lookupError } = await admin.from('users').select('id, org_id, email').eq('id', id).single()
    if (lookupError) throw lookupError
    if (!userRow.email) throw new Error('Selected user has no email address.')
    const { data: linkData, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: userRow.email,
    })
    if (error) throw error
    const actionLink = linkData.properties?.action_link
    if (!actionLink) throw new Error('Supabase did not return an impersonation magic link.')
    await writeAuditLog({ admin, actor: verified, orgId: userRow.org_id, tableName: 'users', recordId: id, action: 'impersonate', newData: { email: userRow.email } })
    return ok({ userId: id, actionLink })
  } catch (error) {
    return fail(error)
  }
}

export async function getDetails(id: string): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const [
      { data: user, error: userError },
      { data: roles },
      { data: auditLog },
      { data: authUsers },
      lookupsResult,
    ] = await Promise.all([
      admin.from('users').select('*, organisations(name, slug), business_units(name)').eq('id', id).single(),
      admin.from('user_roles').select('id, role_id, assigned_at, is_active, roles(id, role_name, description, org_id)').eq('user_id', id).order('assigned_at', { ascending: false }),
      admin.from('audit_log').select('*').or(`changed_by.eq.${id},record_id.eq.${id}`).order('changed_at', { ascending: false }).limit(50),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      getManagementLookups(),
    ])
    if (userError) throw userError
    const authUser = authUsers?.users?.find((authUser: any) => authUser.id === id) ?? null
    const roleIds = (roles ?? []).map((roleRow: any) => roleRow.role_id)
    const { data: permissions } = roleIds.length
      ? await admin.from('permissions').select('*').in('role_id', roleIds).order('module_key')
      : { data: [] }
    return ok({
      user: { ...user, auth_user: authUser, last_login: authUser?.last_sign_in_at ?? null },
      roles: roles ?? [],
      permissions: permissions ?? [],
      auditLog: auditLog ?? [],
      sessions: authUser ? [{ id: authUser.id, email: authUser.email, last_sign_in_at: authUser.last_sign_in_at, created_at: authUser.created_at }] : [],
      lookups: lookupsResult.data ?? { organisations: [], businessUnits: [], roles: [] },
    })
  } catch (error) {
    return fail(error)
  }
}

export async function assignRole(userId: string, roleId: string): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const timestamp = nowIso()
    const [{ data: userRow, error: userError }, { data: role, error: roleError }] = await Promise.all([
      admin.from('users').select('id, org_id').eq('id', userId).single(),
      admin.from('roles').select('id, org_id, role_name').eq('id', roleId).single(),
    ])
    if (userError) throw userError
    if (roleError) throw roleError
    if (userRow.org_id !== role.org_id) throw new Error('Role must belong to the same organisation as the user.')
    const { data, error } = await admin.from('user_roles').insert({
      user_id: userId,
      role_id: roleId,
      assigned_by: verified.userId,
      assigned_at: timestamp,
      is_active: true,
      created_at: timestamp,
      created_by: verified.userId,
    }).select('*').single()
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: userRow.org_id, tableName: 'user_roles', recordId: data.id, action: 'assign_role', newData: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function removeRole(userRoleId: string): Promise<SuperadminActionResult<{ id: string }>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('user_roles').select('*, users(org_id)').eq('id', userRoleId).single()
    if (lookupError) throw lookupError
    const { error } = await admin.from('user_roles').delete().eq('id', userRoleId)
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: (oldData as any).users?.org_id, tableName: 'user_roles', recordId: userRoleId, action: 'remove_role', oldData })
    return ok({ id: userRoleId })
  } catch (error) {
    return fail(error)
  }
}

export async function revokeSessions(id: string): Promise<SuperadminActionResult<{ id: string; message: string }>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: userRow, error: lookupError } = await admin.from('users').select('id, org_id, email').eq('id', id).single()
    if (lookupError) throw lookupError
    await writeAuditLog({ admin, actor: verified, orgId: userRow.org_id, tableName: 'users', recordId: id, action: 'revoke_sessions_requested', newData: { email: userRow.email } })
    return ok({ id, message: 'Session revoke request logged. Supabase requires a session JWT to revoke an individual active session.' })
  } catch (error) {
    return fail(error)
  }
}








