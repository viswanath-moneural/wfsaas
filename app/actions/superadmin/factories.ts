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
    let query = admin.from('tenants').select('*, organisations(name, slug)').order('created_at', { ascending: false })
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
  name: string
  phone?: string | null
  address?: string | null
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const payload = {
      org_id: input.org_id,
      name: input.name.trim(),
      phone: trimOrNull(input.phone),
      address: trimOrNull(input.address),
      is_active: true,
      created_at: nowIso(),
      created_by: verified.userId,
    }

    if (!payload.org_id || !payload.name) throw new Error('Organisation and factory name are required.')

    const { data, error } = await admin.from('tenants').insert(payload).select('*').single()
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: data.org_id, tableName: 'tenants', recordId: data.id, action: 'create', newData: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, input: {
  org_id?: string
  name?: string
  phone?: string | null
  address?: string | null
  is_active?: boolean
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('tenants').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    const payload = {
      ...(input.org_id !== undefined ? { org_id: input.org_id } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.phone !== undefined ? { phone: trimOrNull(input.phone) } : {}),
      ...(input.address !== undefined ? { address: trimOrNull(input.address) } : {}),
      ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      last_modified_at: nowIso(),
      last_modified_by: verified.userId,
    }
    const { data, error } = await admin.from('tenants').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: data.org_id, tableName: 'tenants', recordId: id, action: 'update', oldData, newData: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteFactory(id: string): Promise<SuperadminActionResult<{ id: string }>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('tenants').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    const { error } = await admin.from('tenants').delete().eq('id', id)
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: oldData.org_id, tableName: 'tenants', recordId: id, action: 'delete', oldData })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}
