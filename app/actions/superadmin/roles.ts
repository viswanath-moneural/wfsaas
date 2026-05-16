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
    let query = admin.from('roles').select('*, organisations(name, slug)').order('created_at', { ascending: false })
    if (orgId) query = query.eq('org_id', orgId)
    const { data, error } = await query
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function create(input: {
  org_id: string
  role_name: string
  description?: string | null
  is_system?: boolean
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const payload = {
      org_id: input.org_id,
      role_name: input.role_name.trim().toLowerCase(),
      description: trimOrNull(input.description),
      is_system: input.is_system ?? false,
      created_at: nowIso(),
      created_by: verified.userId,
    }
    if (!payload.org_id || !payload.role_name) throw new Error('Organisation and role name are required.')
    const { data, error } = await admin.from('roles').insert(payload).select('*').single()
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: data.org_id, tableName: 'roles', recordId: data.id, action: 'create', newData: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, input: {
  role_name?: string
  description?: string | null
  is_system?: boolean
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('roles').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    const payload = {
      ...(input.role_name !== undefined ? { role_name: input.role_name.trim().toLowerCase() } : {}),
      ...(input.description !== undefined ? { description: trimOrNull(input.description) } : {}),
      ...(input.is_system !== undefined ? { is_system: input.is_system } : {}),
      last_modified_at: nowIso(),
      last_modified_by: verified.userId,
    }
    const { data, error } = await admin.from('roles').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: data.org_id, tableName: 'roles', recordId: id, action: 'update', oldData, newData: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteRole(id: string): Promise<SuperadminActionResult<{ id: string }>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('roles').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    if (oldData.is_system) throw new Error('System roles cannot be deleted.')
    const { error } = await admin.from('roles').delete().eq('id', id)
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: oldData.org_id, tableName: 'roles', recordId: id, action: 'delete', oldData })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function cloneRole(id: string, roleName: string): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const timestamp = nowIso()
    const { data: source, error: sourceError } = await admin.from('roles').select('*').eq('id', id).single()
    if (sourceError) throw sourceError
    const { data: cloned, error: cloneError } = await admin
      .from('roles')
      .insert({
        org_id: source.org_id,
        role_name: roleName.trim().toLowerCase(),
        description: source.description,
        is_system: false,
        created_at: timestamp,
        created_by: verified.userId,
      })
      .select('*')
      .single()
    if (cloneError) throw cloneError

    const { data: rolePermissions } = await admin.from('role_permissions').select('*').eq('role_id', id)
    if (rolePermissions?.length) {
      const { error: permissionError } = await admin.from('role_permissions').insert(rolePermissions.map((permission: any) => ({
        role_id: cloned.id,
        module_key: permission.module_key,
        can_create: permission.can_create,
        can_read: permission.can_read,
        can_update: permission.can_update,
        can_delete: permission.can_delete,
        created_at: timestamp,
        created_by: verified.userId,
      })))
      if (permissionError) throw permissionError
    }

    await writeAuditLog({ admin, actor: verified, orgId: cloned.org_id, tableName: 'roles', recordId: cloned.id, action: 'clone', oldData: source, newData: cloned })
    return ok(cloned)
  } catch (error) {
    return fail(error)
  }
}
