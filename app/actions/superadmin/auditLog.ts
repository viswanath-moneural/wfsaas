'use server'

import { getSuperadminContext } from '@/lib/auth/getSuperadminContext'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, ok, type SuperadminActionResult } from './_shared'

export async function listAll(filters?: {
  org_id?: string
  table_name?: string
  record_id?: string
  changed_by?: string
  action?: string
  limit?: number
}): Promise<SuperadminActionResult<any[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    let query = admin
      .from('audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(filters?.limit ?? 100)

    if (filters?.org_id) query = query.eq('org_id', filters.org_id)
    if (filters?.table_name) query = query.eq('table_name', filters.table_name)
    if (filters?.record_id) query = query.eq('record_id', filters.record_id)
    if (filters?.changed_by) query = query.eq('changed_by', filters.changed_by)
    if (filters?.action) query = query.eq('action', filters.action)

    const { data, error } = await query
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}
