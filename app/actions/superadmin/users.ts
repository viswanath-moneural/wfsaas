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
    let query = admin.from('users').select('*, organisations(name, slug), tenants(name)').order('created_at', { ascending: false })
    if (orgId) query = query.eq('org_id', orgId)
    const { data, error } = await query
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function create(input: {
  email: string
  password: string
  full_name: string
  org_id: string
  tenant_id?: string | null
  role_id: string
  phone?: string | null
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
          tenant_id: input.tenant_id || null,
          full_name: input.full_name.trim(),
          phone: trimOrNull(input.phone) ?? '0000000000',
          role: role.role_name,
          is_active: true,
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
      return ok(appUser)
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
  tenant_id?: string | null
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
      ...(input.tenant_id !== undefined ? { tenant_id: input.tenant_id || null } : {}),
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

export async function impersonate(id: string): Promise<SuperadminActionResult<{ userId: string; message: string }>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: userRow, error: lookupError } = await admin.from('users').select('id, org_id, email').eq('id', id).single()
    if (lookupError) throw lookupError
    await writeAuditLog({ admin, actor: verified, orgId: userRow.org_id, tableName: 'users', recordId: id, action: 'impersonate_requested', newData: { email: userRow.email } })
    return ok({ userId: id, message: 'Impersonation request audited. Token exchange UI is intentionally not enabled yet.' })
  } catch (error) {
    return fail(error)
  }
}
