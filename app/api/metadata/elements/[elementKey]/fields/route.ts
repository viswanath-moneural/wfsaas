import { NextResponse } from 'next/server'
import { errorJson, getApiContext, getCache, invalidateElementCache, requireElement, setCache, toSnakeCase } from '../../../_lib'

export async function GET(_: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey } = await params

  const elementResult = await requireElement(supabase, orgId, businessUnitId, elementKey)
  if ((elementResult as any).missing) return errorJson('Element not found', 'NOT_FOUND', 404)

  const cacheKey = `element:${elementKey}:fields`
  const cached = await getCache(supabase, orgId, businessUnitId, cacheKey)
  if (cached) return NextResponse.json(cached)

  const { data, error } = await supabase
    .from('data_point_definitions')
    .select('field_key, field_label, field_type, is_core, is_required, is_unique, options, lookup_element_key, sort_order')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .order('sort_order', { ascending: true })
  if (error) return errorJson(error.message, 'DB_ERROR', 500)

  const payload = { fields: data ?? [] }
  await setCache(supabase, orgId, businessUnitId, cacheKey, payload)
  return NextResponse.json(payload)
}

export async function POST(request: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId, userId } = ctx
  const { elementKey } = await params
  const elementResult = await requireElement(supabase, orgId, businessUnitId, elementKey)
  if ((elementResult as any).missing) return errorJson('Element not found', 'NOT_FOUND', 404)

  const body = await request.json()
  const fieldLabel = String(body.field_label ?? '').trim()
  const fieldType = String(body.field_type ?? '').trim()
  if (!fieldLabel || !fieldType) return errorJson('field_label and field_type are required', 'VALIDATION_ERROR', 400)
  const fieldKey = toSnakeCase(body.field_key || fieldLabel)

  const { data: existing } = await supabase
    .from('data_point_definitions')
    .select('id')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .eq('field_key', fieldKey)
    .maybeSingle()
  if (existing) return errorJson('field_key already exists on element', 'FIELD_KEY_CONFLICT', 409)

  if (fieldType === 'lookup') {
    const lookupElementKey = String(body.lookup_element_key ?? '').trim()
    if (!lookupElementKey) return errorJson('lookup_element_key is required for lookup field', 'VALIDATION_ERROR', 400)
    const { data: lookupElement } = await supabase
      .from('element_definitions')
      .select('id')
      .eq('org_id', orgId)
      .eq('business_unit_id', businessUnitId)
      .eq('element_key', lookupElementKey)
      .maybeSingle()
    if (!lookupElement) return errorJson('lookup_element_key does not exist', 'INVALID_LOOKUP', 400)
  }

  const { data, error } = await supabase
    .from('data_point_definitions')
    .insert({
      org_id: orgId,
      business_unit_id: businessUnitId,
      element_key: elementKey,
      field_key: fieldKey,
      field_label: fieldLabel,
      field_type: fieldType,
      is_core: !!body.is_core,
      is_required: !!body.is_required,
      is_unique: !!body.is_unique,
      is_read_only: !!body.is_read_only,
      is_system: !!body.is_system,
      is_searchable: body.is_searchable ?? true,
      is_sortable: body.is_sortable ?? true,
      is_filterable: body.is_filterable ?? true,
      default_value: body.default_value ?? null,
      help_text: body.help_text ?? null,
      description: body.description ?? null,
      placeholder: body.placeholder ?? null,
      options: body.options ?? [],
      formula: body.formula ?? null,
      formula_return_type: body.formula_return_type ?? null,
      min_value: body.min_value ?? null,
      max_value: body.max_value ?? null,
      decimal_places: body.decimal_places ?? 2,
      max_length: body.max_length ?? null,
      lookup_element_key: body.lookup_element_key ?? null,
      lookup_display_field: body.lookup_display_field ?? null,
      lookup_filter: body.lookup_filter ?? null,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
      config: body.config ?? {},
      created_by: userId,
      last_modified_by: userId,
    })
    .select('*')
    .single()
  if (error) return errorJson(error.message, 'DB_ERROR', 500)

  await invalidateElementCache(supabase, orgId, businessUnitId, elementKey)
  return NextResponse.json(data, { status: 201 })
}
