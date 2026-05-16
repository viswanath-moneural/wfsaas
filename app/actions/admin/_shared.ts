import 'server-only'

import { AuthGuardError, type AdminCurrentUser } from '@/lib/auth/guards'

export type AdminActionResult<T> = { data: T | null; error: string | null }

export function ok<T>(data: T): AdminActionResult<T> {
  return { data, error: null }
}

export function fail<T = never>(error: unknown): AdminActionResult<T> {
  if (error instanceof AuthGuardError) return { data: null, error: error.message }
  if (error instanceof Error) return { data: null, error: error.message }
  return { data: null, error: String(error || 'Unknown administration action error.') }
}

export function nowIso() {
  return new Date().toISOString()
}

export function actorName(actor: AdminCurrentUser) {
  return [actor.first_name, actor.last_name].filter(Boolean).join(' ') || actor.email
}

export function generateTempPassword() {
  const token = globalThis.crypto?.randomUUID?.().replaceAll('-', '').slice(0, 12)
    ?? Math.random().toString(36).slice(2, 14)
  return `Wf@${token}`
}





