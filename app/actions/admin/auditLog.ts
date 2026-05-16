'use server'

import { requireOrgAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { actorName, fail, ok, type AdminActionResult } from './_shared'

export interface AuditLogPayload {
  org_id?: string | null
  actor_id?: string | null
  actor_email?: string | null
  actor_role?: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  entity_name?: string | null
  changes?: unknown
  ip_address?: string | null
  user_agent?: string | null
  status?: 'success' | 'failed'
}

export async function log(payload: AuditLogPayload): Promise<AdminActionResult<any>> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('audit_log')
      .insert({
        org_id: payload.org_id ?? null,
        actor_id: payload.actor_id ?? null,
        actor_email: payload.actor_email ?? null,
        actor_role: payload.actor_role ?? null,
        action: payload.action,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id ?? null,
        entity_name: payload.entity_name ?? null,
        changes: payload.changes ?? null,
        ip_address: payload.ip_address ?? null,
        user_agent: payload.user_agent ?? null,
        status: payload.status ?? 'success',
      })
      .select('*')
      .single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function logMutation(input: {
  actor: Awaited<ReturnType<typeof requireOrgAdmin>>
  org_id?: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  entity_name?: string | null
  before?: unknown
  after?: unknown
}) {
  return log({
    org_id: input.org_id ?? input.actor.org_id,
    actor_id: input.actor.id,
    actor_email: input.actor.email,
    actor_role: input.actor.role?.name ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    entity_name: input.entity_name ?? null,
    changes: { before: input.before ?? null, after: input.after ?? null },
  })
}

export async function getAll(filters?: {
  org_id?: string
  actor_id?: string
  action?: string
  entity_type?: string
  actor_email?: string
  date_from?: string
  date_to?: string
  limit?: number
}): Promise<AdminActionResult<any[]>> {
  try {
    const actor = await requireOrgAdmin()
    const admin = createAdminClient()
    let query = admin
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters?.limit ?? 200)

    if (!actor.is_superadmin && actor.org_id) query = query.eq('org_id', actor.org_id)
    if (filters?.org_id) query = query.eq('org_id', filters.org_id)
    if (filters?.actor_id) query = query.eq('actor_id', filters.actor_id)
    if (filters?.action) query = query.eq('action', filters.action)
    if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type)
    if (filters?.actor_email) query = query.ilike('actor_email', `%${filters.actor_email}%`)
    if (filters?.date_from) query = query.gte('created_at', filters.date_from)
    if (filters?.date_to) query = query.lte('created_at', filters.date_to)

    const { data, error } = await query
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}
