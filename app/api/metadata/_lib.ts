import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type ApiContext = {
  supabase: any
  userId: string
  orgId: string
  businessUnitId: string
}

export function errorJson(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

export function toSnakeCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function getApiContext(): Promise<ApiContext | NextResponse> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) {
    return errorJson('Authentication required', 'UNAUTHENTICATED', 401)
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, org_id, business_unit_id, is_active')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (userError) return errorJson(userError.message, 'DB_ERROR', 500)
  if (!user?.is_active) return errorJson('User inactive', 'FORBIDDEN', 403)
  if (!user?.org_id) return errorJson('User has no org', 'MISSING_ORG', 400)
  if (!user?.business_unit_id) return errorJson('User has no business unit', 'MISSING_BUSINESS_UNIT', 400)

  return { supabase, userId: user.id, orgId: user.org_id, businessUnitId: user.business_unit_id }
}

export async function getCache(supabase: any, orgId: string, businessUnitId: string, cacheKey: string) {
  const { data, error } = await supabase
    .from('metadata_cache')
    .select('payload, expires_at')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error || !data) return null
  return data.payload
}

export async function setCache(supabase: any, orgId: string, businessUnitId: string, cacheKey: string, payload: unknown) {
  await supabase.from('metadata_cache').upsert(
    {
      org_id: orgId,
      business_unit_id: businessUnitId,
      cache_key: cacheKey,
      payload,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'org_id,business_unit_id,cache_key' }
  )
}

export async function invalidateElementCache(supabase: any, orgId: string, businessUnitId: string, elementKey: string) {
  const like = `%element:${elementKey}:%`
  await supabase
    .from('metadata_cache')
    .delete()
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .ilike('cache_key', like)
}

export async function invalidateAllMetadataCache(supabase: any, orgId: string, businessUnitId: string) {
  await supabase.from('metadata_cache').delete().eq('org_id', orgId).eq('business_unit_id', businessUnitId)
}

export async function requireElement(supabase: any, orgId: string, businessUnitId: string, elementKey: string) {
  const { data, error } = await supabase
    .from('element_definitions')
    .select('*')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .maybeSingle()
  if (error) return { error }
  if (!data) return { missing: true }
  return { data }
}
