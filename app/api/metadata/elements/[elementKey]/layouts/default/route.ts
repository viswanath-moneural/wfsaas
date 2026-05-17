import { NextResponse } from 'next/server'
import { errorJson, getApiContext, getCache, requireElement, setCache } from '../../../../_lib'

type SectionField = { field_key: string; column?: number; row?: number; is_required_override?: boolean }
type Section = { id: string; title: string; columns: 1 | 2; fields: SectionField[] }

export async function GET(_: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey } = await params

  const element = await requireElement(supabase, orgId, businessUnitId, elementKey)
  if ((element as any).missing) return errorJson('Element not found', 'NOT_FOUND', 404)

  const cacheKey = `element:${elementKey}:layout:default`
  const cached = await getCache(supabase, orgId, businessUnitId, cacheKey)
  if (cached) return NextResponse.json(cached)

  const [{ data: layout, error: layoutError }, { data: fields, error: fieldsError }] = await Promise.all([
    supabase
      .from('screen_design_definitions')
      .select('design_name, sections')
      .eq('org_id', orgId)
      .eq('business_unit_id', businessUnitId)
      .eq('element_key', elementKey)
      .eq('is_default', true)
      .order('last_modified_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('data_point_definitions')
      .select('field_key, field_label, field_type, is_required')
      .eq('org_id', orgId)
      .eq('business_unit_id', businessUnitId)
      .eq('element_key', elementKey)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])
  if (layoutError || fieldsError) return errorJson(layoutError?.message || fieldsError?.message || 'DB_ERROR', 'DB_ERROR', 500)

  const sections: Section[] = Array.isArray(layout?.sections) ? layout.sections : []
  const used = new Set<string>()
  for (const section of sections) {
    for (const field of section.fields ?? []) used.add(field.field_key)
  }

  const fieldsByKey = new Map<string, any>((fields ?? []).map((field: any) => [field.field_key, field]))
  const hydratedSections = sections.map((section) => ({
    ...section,
    fields: (section.fields ?? []).map((field: any) => {
      const source = fieldsByKey.get(field.field_key)
      return {
        field_key: field.field_key,
        field_label: source?.field_label ?? field.field_key,
        field_type: source?.field_type ?? 'text',
        is_required: field.is_required_override ?? source?.is_required ?? false,
        column: field.column ?? 1,
        row: field.row ?? 1,
      }
    }),
  }))

  const availableFields = (fields ?? []).filter((field: any) => !used.has(field.field_key))
  const payload = {
    design_name: layout?.design_name ?? 'Default Layout',
    sections: hydratedSections,
    available_fields: availableFields,
  }
  await setCache(supabase, orgId, businessUnitId, cacheKey, payload)
  return NextResponse.json(payload)
}
