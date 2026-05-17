import { NextResponse } from 'next/server'
import { errorJson, getApiContext, getCache, invalidateElementCache, requireElement, setCache, toSnakeCase } from '../../../_lib'

export async function GET(_: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey } = await params
  const element = await requireElement(supabase, orgId, businessUnitId, elementKey)
  if ((element as any).missing) return errorJson('Element not found', 'NOT_FOUND', 404)

  const cacheKey = `element:${elementKey}:rules`
  const cached = await getCache(supabase, orgId, businessUnitId, cacheKey)
  if (cached) return NextResponse.json(cached)

  const { data, error } = await supabase
    .from('data_rule_definitions')
    .select('*')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .order('sort_order', { ascending: true })
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  const payload = { rules: data ?? [] }
  await setCache(supabase, orgId, businessUnitId, cacheKey, payload)
  return NextResponse.json(payload)
}

export async function POST(request: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId, userId } = ctx
  const { elementKey } = await params
  const body = await request.json()
  const ruleName = String(body.rule_name ?? '').trim()
  if (!ruleName || !body.condition_formula || !body.error_message) return errorJson('rule_name, condition_formula, error_message are required', 'VALIDATION_ERROR', 400)

  const { data, error } = await supabase
    .from('data_rule_definitions')
    .insert({
      org_id: orgId,
      business_unit_id: businessUnitId,
      element_key: elementKey,
      rule_key: body.rule_key ?? toSnakeCase(ruleName),
      rule_name: ruleName,
      description: body.description ?? null,
      trigger_on: body.trigger_on ?? ['insert', 'update'],
      condition_formula: body.condition_formula,
      error_message: body.error_message,
      error_field_key: body.error_field_key ?? null,
      is_active: body.is_active ?? true,
      sort_order: body.sort_order ?? 0,
      created_by: userId,
      last_modified_by: userId,
    })
    .select('*')
    .single()
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  await invalidateElementCache(supabase, orgId, businessUnitId, elementKey)
  return NextResponse.json(data, { status: 201 })
}
