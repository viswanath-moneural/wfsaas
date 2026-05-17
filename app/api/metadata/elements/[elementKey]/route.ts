import { NextResponse } from 'next/server'
import { errorJson, getApiContext, getCache, requireElement, setCache } from '../../_lib'

export async function GET(_: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey } = await params

  const cacheKey = `element:${elementKey}:full`
  const cached = await getCache(supabase, orgId, businessUnitId, cacheKey)
  if (cached) return NextResponse.json(cached)

  const elementResult = await requireElement(supabase, orgId, businessUnitId, elementKey)
  if ((elementResult as any).error) return errorJson((elementResult as any).error.message, 'DB_ERROR', 500)
  if ((elementResult as any).missing) return errorJson('Element not found', 'NOT_FOUND', 404)

  const [{ data: fields, error: fieldsError }, { data: rules, error: rulesError }, { data: outgoing, error: outError }, { data: incoming, error: inError }, { data: layout, error: layoutError }] = await Promise.all([
    supabase.from('data_point_definitions').select('*').eq('org_id', orgId).eq('business_unit_id', businessUnitId).eq('element_key', elementKey).order('sort_order', { ascending: true }),
    supabase.from('data_rule_definitions').select('*').eq('org_id', orgId).eq('business_unit_id', businessUnitId).eq('element_key', elementKey).order('sort_order', { ascending: true }),
    supabase.from('data_bond_definitions').select('*').eq('org_id', orgId).eq('business_unit_id', businessUnitId).eq('from_element_key', elementKey),
    supabase.from('data_bond_definitions').select('*').eq('org_id', orgId).eq('business_unit_id', businessUnitId).eq('to_element_key', elementKey),
    supabase.from('screen_design_definitions').select('*').eq('org_id', orgId).eq('business_unit_id', businessUnitId).eq('element_key', elementKey).eq('is_default', true).order('last_modified_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (fieldsError || rulesError || outError || inError || layoutError) {
    return errorJson(fieldsError?.message || rulesError?.message || outError?.message || inError?.message || layoutError?.message || 'Metadata read failed', 'DB_ERROR', 500)
  }

  const payload = {
    element: (elementResult as any).data,
    fields: fields ?? [],
    bonds: [...(outgoing ?? []), ...(incoming ?? [])],
    rules: rules ?? [],
    default_layout: layout ? { sections: layout.sections ?? [] } : null,
  }

  await setCache(supabase, orgId, businessUnitId, cacheKey, payload)
  return NextResponse.json(payload)
}
