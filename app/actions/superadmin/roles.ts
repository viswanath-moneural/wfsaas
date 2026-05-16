'use server'

import { getSuperadminContext } from '@/lib/auth/getSuperadminContext'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, trimOrNull, writeAuditLog, type SuperadminActionResult } from './_shared'
import { MODULE_LIST } from '@/lib/modules'

const systemRoleNames = new Set(['superadmin', 'owner', 'admin', 'staff'])

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

export async function listWithMetrics(): Promise<SuperadminActionResult<any[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const [{ data: roles, error }, { data: assignments }] = await Promise.all([
      admin.from('roles').select('*, organisations(name, slug)').order('created_at', { ascending: false }),
      admin.from('user_roles').select('id, role_id').eq('is_active', true),
    ])
    if (error) throw error
    const counts = new Map<string, number>()
    ;(assignments ?? []).forEach((assignment: any) => counts.set(assignment.role_id, (counts.get(assignment.role_id) ?? 0) + 1))
    return ok((roles ?? []).map((role: any) => ({
      ...role,
      is_system: role.is_system || systemRoleNames.has(String(role.role_name ?? '').toLowerCase()),
      user_count: counts.get(role.id) ?? 0,
    })))
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

export async function createRoleWithPermissions(input: {
  role_name: string
  description?: string | null
  scope: 'global' | 'org'
  org_id?: string | null
  clone_from_role_id?: string | null
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const timestamp = nowIso()
    const roleName = input.role_name.trim().toLowerCase()
    if (!roleName) throw new Error('Role name is required.')

    const { data: organisations, error: orgError } = input.scope === 'global'
      ? await admin.from('organisations').select('id').eq('is_active', true)
      : await admin.from('organisations').select('id').eq('id', input.org_id ?? '').limit(1)
    if (orgError) throw orgError
    if (!organisations?.length) throw new Error('No organisation scope found for this role.')

    const createdRoles = []
    for (const organisation of organisations as any[]) {
      const { data: role, error } = await admin
        .from('roles')
        .insert({
          org_id: organisation.id,
          role_name: roleName,
          description: trimOrNull(input.description),
          is_system: false,
          created_at: timestamp,
          created_by: verified.userId,
        })
        .select('*')
        .single()
      if (error) throw error
      createdRoles.push(role)

      if (input.clone_from_role_id) {
        await copyPermissions(admin, input.clone_from_role_id, role.id, verified.userId)
      } else {
        await seedEmptyPermissions(admin, role.id)
      }

      await writeAuditLog({ admin, actor: verified, orgId: role.org_id, tableName: 'roles', recordId: role.id, action: 'create', newData: role })
    }

    return ok(createdRoles[0])
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

    await copyPermissions(admin, id, cloned.id, verified.userId)

    await writeAuditLog({ admin, actor: verified, orgId: cloned.org_id, tableName: 'roles', recordId: cloned.id, action: 'clone', oldData: source, newData: cloned })
    return ok(cloned)
  } catch (error) {
    return fail(error)
  }
}

export async function cloneRoleDefaultName(id: string): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: source, error } = await admin.from('roles').select('role_name').eq('id', id).single()
    if (error) throw error
    return cloneRole(id, `copy of ${source.role_name}`)
  } catch (error) {
    return fail(error)
  }
}

export async function getDetails(id: string): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const [{ data: role, error }, { data: permissions }, { data: userRoles }] = await Promise.all([
      admin.from('roles').select('*, organisations(name, slug)').eq('id', id).single(),
      admin.from('permissions').select('*').eq('role_id', id).order('module_key'),
      admin.from('user_roles').select('id').eq('role_id', id).eq('is_active', true),
    ])
    if (error) throw error
    const permissionMap = new Map((permissions ?? []).map((permission: any) => [permission.module_key, permission]))
    const matrix = MODULE_LIST.map((moduleItem) => permissionMap.get(moduleItem.key) ?? {
      role_id: id,
      module_key: moduleItem.key,
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
      can_export: false,
      can_approve: false,
    })
    return ok({
      role: {
        ...role,
        is_system: role.is_system || systemRoleNames.has(String(role.role_name ?? '').toLowerCase()),
        user_count: userRoles?.length ?? 0,
      },
      permissions: matrix,
      modules: MODULE_LIST,
    })
  } catch (error) {
    return fail(error)
  }
}

async function seedEmptyPermissions(admin: ReturnType<typeof createAdminClient>, roleId: string) {
  const payload = MODULE_LIST.map((moduleItem) => ({
    role_id: roleId,
    module_key: moduleItem.key,
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
    can_export: false,
    can_approve: false,
    created_at: nowIso(),
  }))
  const { error } = await admin.from('permissions').upsert(payload, { onConflict: 'role_id,module_key' })
  if (error) throw error
}

async function copyPermissions(admin: ReturnType<typeof createAdminClient>, sourceRoleId: string, targetRoleId: string, actorId: string) {
  const timestamp = nowIso()
  const { data: permissions, error } = await admin.from('permissions').select('*').eq('role_id', sourceRoleId)
  if (error) throw error
  if (permissions?.length) {
    const { error: insertError } = await admin.from('permissions').insert(permissions.map((permission: any) => ({
      role_id: targetRoleId,
      module_key: permission.module_key,
      can_view: permission.can_view,
      can_create: permission.can_create,
      can_edit: permission.can_edit,
      can_delete: permission.can_delete,
      can_export: permission.can_export,
      can_approve: permission.can_approve,
      created_at: timestamp,
    })))
    if (insertError) throw insertError
  } else {
    await seedEmptyPermissions(admin, targetRoleId)
  }

  const { data: legacyPermissions } = await admin.from('role_permissions').select('*').eq('role_id', sourceRoleId)
  if (legacyPermissions?.length) {
    const { error: legacyError } = await admin.from('role_permissions').insert(legacyPermissions.map((permission: any) => ({
      role_id: targetRoleId,
      module_key: permission.module_key,
      can_create: permission.can_create,
      can_read: permission.can_read,
      can_update: permission.can_update,
      can_delete: permission.can_delete,
      created_at: timestamp,
      created_by: actorId,
    })))
    if (legacyError) throw legacyError
  }
}
