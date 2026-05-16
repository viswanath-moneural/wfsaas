'use server'

import { getSuperadminContext } from '@/lib/auth/getSuperadminContext'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, writeAuditLog, type SuperadminActionResult } from './_shared'

export async function listAll(orgId?: string): Promise<SuperadminActionResult<any[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    let query = admin.from('org_modules').select('*, organisations(name, slug)').order('module_key')
    if (orgId) query = query.eq('org_id', orgId)
    const { data, error } = await query
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

async function setModule(orgId: string, moduleKey: string, enabled: boolean, action: string) {
  const verified = await requireSuperadmin()
  await getSuperadminContext(verified)
  const admin = createAdminClient()
  const timestamp = nowIso()
  const { data: oldData } = await admin
    .from('org_modules')
    .select('*')
    .eq('org_id', orgId)
    .eq('module_key', moduleKey)
    .maybeSingle()

  const payload = {
    org_id: orgId,
    module_key: moduleKey,
    is_enabled: enabled,
    last_modified_at: timestamp,
    last_modified_by: verified.userId,
  }

  const { data, error } = await admin
    .from('org_modules')
    .upsert({ ...payload, created_at: oldData?.created_at ?? timestamp, created_by: oldData?.created_by ?? verified.userId }, { onConflict: 'org_id,module_key' })
    .select('*')
    .single()
  if (error) throw error
  await writeAuditLog({ admin, actor: verified, orgId, tableName: 'org_modules', recordId: data.id, action, oldData, newData: data })
  return data
}

export async function enable(orgId: string, moduleKey: string): Promise<SuperadminActionResult<any>> {
  try {
    return ok(await setModule(orgId, moduleKey, true, 'enable'))
  } catch (error) {
    return fail(error)
  }
}

export async function disable(orgId: string, moduleKey: string): Promise<SuperadminActionResult<any>> {
  try {
    return ok(await setModule(orgId, moduleKey, false, 'disable'))
  } catch (error) {
    return fail(error)
  }
}

export async function toggleForOrg(orgId: string, moduleKey: string, enabled: boolean): Promise<SuperadminActionResult<any>> {
  try {
    return ok(await setModule(orgId, moduleKey, enabled, enabled ? 'enable' : 'disable'))
  } catch (error) {
    return fail(error)
  }
}
