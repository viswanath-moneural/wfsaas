'use server'

import { getSuperadminContext } from '@/lib/auth/getSuperadminContext'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, trimOrNull, writeAuditLog, type SuperadminActionResult } from './_shared'

export async function listAll(): Promise<SuperadminActionResult<any[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data, error } = await admin.from('organisations').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function create(input: {
  name: string
  slug: string
  country?: string | null
  timezone?: string | null
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const timestamp = nowIso()
    const payload = {
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      country: trimOrNull(input.country),
      timezone: trimOrNull(input.timezone),
      is_active: true,
      created_at: timestamp,
      created_by: verified.userId,
    }

    if (!payload.name || !payload.slug) throw new Error('Organisation name and slug are required.')

    const { data, error } = await admin.from('organisations').insert(payload).select('*').single()
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: data.id, tableName: 'organisations', recordId: data.id, action: 'create', newData: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, input: {
  name?: string
  slug?: string
  country?: string | null
  timezone?: string | null
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('organisations').select('*').eq('id', id).single()
    if (lookupError) throw lookupError

    const payload = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug !== undefined ? { slug: input.slug.trim().toLowerCase() } : {}),
      ...(input.country !== undefined ? { country: trimOrNull(input.country) } : {}),
      ...(input.timezone !== undefined ? { timezone: trimOrNull(input.timezone) } : {}),
      updated_at: nowIso(),
      last_modified_at: nowIso(),
      last_modified_by: verified.userId,
    }

    const { data, error } = await admin.from('organisations').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: id, tableName: 'organisations', recordId: id, action: 'update', oldData, newData: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteOrganisation(id: string): Promise<SuperadminActionResult<{ id: string }>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('organisations').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    const { error } = await admin.from('organisations').delete().eq('id', id)
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: id, tableName: 'organisations', recordId: id, action: 'delete', oldData })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

async function setActive(id: string, isActive: boolean, action: 'suspend' | 'activate') {
  const verified = await requireSuperadmin()
  await getSuperadminContext(verified)
  const admin = createAdminClient()
  const { data: oldData, error: lookupError } = await admin.from('organisations').select('*').eq('id', id).single()
  if (lookupError) throw lookupError
  const { data, error } = await admin
    .from('organisations')
    .update({ is_active: isActive, updated_at: nowIso(), last_modified_at: nowIso(), last_modified_by: verified.userId })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  await writeAuditLog({ admin, actor: verified, orgId: id, tableName: 'organisations', recordId: id, action, oldData, newData: data })
  return data
}

export async function suspend(id: string): Promise<SuperadminActionResult<any>> {
  try {
    return ok(await setActive(id, false, 'suspend'))
  } catch (error) {
    return fail(error)
  }
}

export async function activate(id: string): Promise<SuperadminActionResult<any>> {
  try {
    return ok(await setActive(id, true, 'activate'))
  } catch (error) {
    return fail(error)
  }
}
