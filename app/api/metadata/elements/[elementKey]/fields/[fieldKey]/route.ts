import { NextResponse } from 'next/server'
import { errorJson, getApiContext, invalidateElementCache, requireElement } from '../../../../_lib'

export async function GET(_: Request, { params }: { params: Promise<{ elementKey: string; fieldKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey, fieldKey } = await params
  const element = await requireElement(supabase, orgId, businessUnitId, elementKey)
  if ((element as any).missing) return errorJson('Element not found', 'NOT_FOUND', 404)

  const { data, error } = await supabase
    .from('data_point_definitions')
    .select('*')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .eq('field_key', fieldKey)
    .maybeSingle()
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  if (!data) return errorJson('Field not found', 'NOT_FOUND', 404)
  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ elementKey: string; fieldKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId, userId } = ctx
  const { elementKey, fieldKey } = await params
  const body = await request.json()
  const { data, error } = await supabase
    .from('data_point_definitions')
    .update({
      field_label: body.field_label,
      field_type: body.field_type,
      is_required: body.is_required,
      is_unique: body.is_unique,
      is_read_only: body.is_read_only,
      is_system: body.is_system,
      is_searchable: body.is_searchable,
      is_sortable: body.is_sortable,
      is_filterable: body.is_filterable,
      default_value: body.default_value,
      help_text: body.help_text,
      description: body.description,
      placeholder: body.placeholder,
      options: body.options,
      formula: body.formula,
      formula_return_type: body.formula_return_type,
      min_value: body.min_value,
      max_value: body.max_value,
      decimal_places: body.decimal_places,
      max_length: body.max_length,
      lookup_element_key: body.lookup_element_key,
      lookup_display_field: body.lookup_display_field,
      lookup_filter: body.lookup_filter,
      sort_order: body.sort_order,
      is_active: body.is_active,
      config: body.config,
      last_modified_at: new Date().toISOString(),
      last_modified_by: userId,
    })
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .eq('field_key', fieldKey)
    .select('*')
    .maybeSingle()
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  if (!data) return errorJson('Field not found', 'NOT_FOUND', 404)
  await invalidateElementCache(supabase, orgId, businessUnitId, elementKey)
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ elementKey: string; fieldKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey, fieldKey } = await params
  const { error } = await supabase
    .from('data_point_definitions')
    .delete()
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .eq('field_key', fieldKey)
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  await invalidateElementCache(supabase, orgId, businessUnitId, elementKey)
  return NextResponse.json({ ok: true })
}
