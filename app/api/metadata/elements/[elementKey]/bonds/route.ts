import { NextResponse } from 'next/server'
import { errorJson, getApiContext, getCache, invalidateElementCache, requireElement, setCache } from '../../../_lib'

export async function GET(_: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey } = await params
  const element = await requireElement(supabase, orgId, businessUnitId, elementKey)
  if ((element as any).missing) return errorJson('Element not found', 'NOT_FOUND', 404)

  const cacheKey = `element:${elementKey}:bonds`
  const cached = await getCache(supabase, orgId, businessUnitId, cacheKey)
  if (cached) return NextResponse.json(cached)

  const { data, error } = await supabase
    .from('data_bond_definitions')
    .select('*')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .or(`from_element_key.eq.${elementKey},to_element_key.eq.${elementKey}`)
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  const payload = { bonds: data ?? [] }
  await setCache(supabase, orgId, businessUnitId, cacheKey, payload)
  return NextResponse.json(payload)
}

export async function POST(request: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId, userId } = ctx
  const { elementKey } = await params
  const body = await request.json()
  const { data, error } = await supabase
    .from('data_bond_definitions')
    .insert({
      org_id: orgId,
      business_unit_id: businessUnitId,
      bond_key: body.bond_key,
      bond_name: body.bond_name,
      bond_type: body.bond_type,
      from_element_key: elementKey,
      from_field_key: body.from_field_key,
      to_element_key: body.to_element_key,
      to_field_key: body.to_field_key ?? 'id',
      display_field_key: body.display_field_key ?? null,
      related_list_label: body.related_list_label ?? null,
      show_related_list: body.show_related_list ?? true,
      on_delete: body.on_delete ?? 'restrict',
      is_core: body.is_core ?? false,
      is_required: body.is_required ?? false,
      junction_table: body.junction_table ?? null,
      created_by: userId,
      last_modified_by: userId,
    })
    .select('*')
    .single()
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  await invalidateElementCache(supabase, orgId, businessUnitId, elementKey)
  return NextResponse.json(data, { status: 201 })
}
