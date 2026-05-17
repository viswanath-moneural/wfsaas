import { NextResponse } from 'next/server'
import { errorJson, getApiContext, getCache, invalidateElementCache, requireElement, setCache } from '../../../_lib'

export async function GET(_: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey } = await params
  const element = await requireElement(supabase, orgId, businessUnitId, elementKey)
  if ((element as any).missing) return errorJson('Element not found', 'NOT_FOUND', 404)

  const cacheKey = `element:${elementKey}:layouts`
  const cached = await getCache(supabase, orgId, businessUnitId, cacheKey)
  if (cached) return NextResponse.json(cached)

  const { data, error } = await supabase
    .from('screen_design_definitions')
    .select('*')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .order('is_default', { ascending: false })
    .order('last_modified_at', { ascending: false })
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  const payload = { layouts: data ?? [] }
  await setCache(supabase, orgId, businessUnitId, cacheKey, payload)
  return NextResponse.json(payload)
}

export async function POST(request: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId, userId } = ctx
  const { elementKey } = await params
  const body = await request.json()
  const isDefault = !!body.is_default

  if (isDefault) {
    await supabase
      .from('screen_design_definitions')
      .update({ is_default: false, last_modified_at: new Date().toISOString(), last_modified_by: userId })
      .eq('org_id', orgId)
      .eq('business_unit_id', businessUnitId)
      .eq('element_key', elementKey)
  }

  const { data, error } = await supabase
    .from('screen_design_definitions')
    .insert({
      org_id: orgId,
      business_unit_id: businessUnitId,
      element_key: elementKey,
      design_name: body.design_name ?? 'Default Layout',
      is_default: isDefault,
      sections: body.sections ?? [],
      created_by: userId,
      last_modified_by: userId,
    })
    .select('*')
    .single()
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  await invalidateElementCache(supabase, orgId, businessUnitId, elementKey)
  return NextResponse.json(data, { status: 201 })
}
