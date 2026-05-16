'use server'

import { getSuperadminContext } from '@/lib/auth/getSuperadminContext'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, writeAuditLog, type SuperadminActionResult } from './_shared'

export async function getByRole(roleId: string): Promise<SuperadminActionResult<any[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data, error } = await admin.from('permissions').select('*').eq('role_id', roleId).order('module_key')
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function bulkUpdate(roleId: string, permissions: Array<{
  module_key: string
  can_view?: boolean
  can_create?: boolean
  can_edit?: boolean
  can_delete?: boolean
  can_export?: boolean
  can_approve?: boolean
}>): Promise<SuperadminActionResult<any[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: role, error: roleError } = await admin.from('roles').select('*').eq('id', roleId).single()
    if (roleError) throw roleError
    const { data: oldData } = await admin.from('permissions').select('*').eq('role_id', roleId)
    const timestamp = nowIso()
    const payload = permissions.map((permission) => ({
      role_id: roleId,
      module_key: permission.module_key,
      can_view: permission.can_view ?? false,
      can_create: permission.can_create ?? false,
      can_edit: permission.can_edit ?? false,
      can_delete: permission.can_delete ?? false,
      can_export: permission.can_export ?? false,
      can_approve: permission.can_approve ?? false,
      created_at: timestamp,
    }))

    const { data, error } = await admin
      .from('permissions')
      .upsert(payload, { onConflict: 'role_id,module_key' })
      .select('*')
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: role.org_id, tableName: 'permissions', recordId: roleId, action: 'bulk_update', oldData, newData: data })
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}
