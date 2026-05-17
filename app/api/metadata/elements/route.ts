import { NextResponse } from 'next/server'
import { errorJson, getApiContext, getCache, setCache } from '../_lib'

export async function GET() {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx

  const cacheKey = 'elements:list'
  const cached = await getCache(supabase, orgId, businessUnitId, cacheKey)
  if (cached) return NextResponse.json(cached)

  const { data, error } = await supabase
    .from('element_definitions')
    .select('element_key, element_name, element_name_plural, icon, color, is_core')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) return errorJson(error.message, 'DB_ERROR', 500)

  const elements = await Promise.all(
    (data ?? []).map(async (row: any) => {
      const [{ count: fieldCount }, { count: bondCount }, { count: ruleCount }] = await Promise.all([
        supabase.from('data_point_definitions').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('business_unit_id', businessUnitId).eq('element_key', row.element_key),
        supabase.from('data_bond_definitions').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('business_unit_id', businessUnitId).or(`from_element_key.eq.${row.element_key},to_element_key.eq.${row.element_key}`),
        supabase.from('data_rule_definitions').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('business_unit_id', businessUnitId).eq('element_key', row.element_key),
      ])

      return {
        element_key: row.element_key,
        element_name: row.element_name,
        element_name_plural: row.element_name_plural,
        icon: row.icon,
        color: row.color,
        is_core: row.is_core,
        field_count: fieldCount ?? 0,
        bond_count: bondCount ?? 0,
        rule_count: ruleCount ?? 0,
      }
    })
  )

  const payload = { elements }
  await setCache(supabase, orgId, businessUnitId, cacheKey, payload)
  return NextResponse.json(payload)
}
