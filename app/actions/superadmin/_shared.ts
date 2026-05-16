import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { UnauthorizedError, type VerifiedSuperadmin } from '@/lib/auth/requireSuperadmin'

export type SuperadminActionResult<T> = {
  data: T | null
  error: string | null
}

export function ok<T>(data: T): SuperadminActionResult<T> {
  return { data, error: null }
}

export function fail<T = null>(error: unknown): SuperadminActionResult<T> {
  if (error instanceof UnauthorizedError) return { data: null, error: error.message }
  if (error instanceof Error) return { data: null, error: error.message }
  return { data: null, error: String(error || 'Unexpected superadmin action error.') }
}

export function nowIso() {
  return new Date().toISOString()
}

export async function writeAuditLog(input: {
  admin: SupabaseClient
  actor: VerifiedSuperadmin
  orgId?: string | null
  tableName: string
  recordId?: string | null
  action: string
  oldData?: unknown
  newData?: unknown
  entityName?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}) {
  const timestamp = nowIso()
  const changes = { before: input.oldData ?? null, after: input.newData ?? null }
  const { error } = await input.admin.from('audit_log').insert({
    org_id: input.orgId ?? input.actor.orgId,
    table_name: input.tableName,
    record_id: input.recordId ?? null,
    action: input.action,
    old_data: input.oldData ?? null,
    new_data: input.newData ?? null,
    changed_by: input.actor.userId,
    changed_at: timestamp,
    created_at: timestamp,
    created_by: input.actor.userId,
    actor_id: input.actor.userId,
    actor_email: input.actor.appUser.email ?? input.actor.authUser.email ?? null,
    entity_type: input.tableName,
    entity_id: input.recordId ?? null,
    entity_name: input.entityName ?? null,
    changes,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  })

  if (error) throw new Error(`Audit log failed: ${error.message}`)
}

export function trimOrNull(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}
