'use server'

import { getSuperadminContext } from '@/lib/auth/getSuperadminContext'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, ok, type SuperadminActionResult } from './_shared'

export async function listAll(filters?: {
  org_id?: string
  table_name?: string
  entity_type?: string
  record_id?: string
  changed_by?: string
  actor_id?: string
  action?: string
  date_from?: string
  date_to?: string
  limit?: number
}): Promise<SuperadminActionResult<any[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    let query = admin
      .from('audit_log')
      .select('*, organisations(name, slug)')
      .order('created_at', { ascending: false })
      .limit(filters?.limit ?? 100)

    if (filters?.org_id) query = query.eq('org_id', filters.org_id)
    if (filters?.table_name) query = query.eq('table_name', filters.table_name)
    if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type)
    if (filters?.record_id) query = query.eq('record_id', filters.record_id)
    if (filters?.changed_by) query = query.eq('changed_by', filters.changed_by)
    if (filters?.actor_id) query = query.eq('actor_id', filters.actor_id)
    if (filters?.action) query = query.eq('action', filters.action)
    if (filters?.date_from) query = query.gte('created_at', filters.date_from)
    if (filters?.date_to) query = query.lte('created_at', filters.date_to)

    const { data, error } = await query
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}





