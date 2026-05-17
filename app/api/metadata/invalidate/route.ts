import { NextResponse } from 'next/server'
import { errorJson, getApiContext, invalidateAllMetadataCache, invalidateElementCache } from '../_lib'

export async function POST(request: Request) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx

  const body = await request.json().catch(() => ({}))
  const elementKey = typeof body.element_key === 'string' ? body.element_key.trim() : ''

  if (elementKey) {
    await invalidateElementCache(supabase, orgId, businessUnitId, elementKey)
    return NextResponse.json({ ok: true, scope: `element:${elementKey}` })
  }

  await invalidateAllMetadataCache(supabase, orgId, businessUnitId)
  return NextResponse.json({ ok: true, scope: 'all' })
}
