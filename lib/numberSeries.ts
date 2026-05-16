import { getSupabaseClient } from '@/lib/supabase'

interface NumberSeriesConfig {
  id: string
  business_unit_id: string
  entity_type: string
  prefix: string | null
  suffix: string | null
  separator: string | null
  include_fin_year: boolean | null
  include_month: boolean | null
  num_digits: number | null
  start_from: number | null
  current_value: number | null
  is_active: boolean | null
}

const SERIES_ALIASES: Record<string, string> = {
  PO: 'purchase_order',
  GRN: 'grn',
}

const DEFAULT_SERIES: Record<string, { prefix: string; separator: string; num_digits: number; start_from: number; include_fin_year: boolean; include_month: boolean }> = {
  purchase_order: { prefix: 'PO', separator: '-', num_digits: 4, start_from: 1, include_fin_year: true, include_month: false },
  grn: { prefix: 'GRN', separator: '-', num_digits: 4, start_from: 1, include_fin_year: true, include_month: false },
}

function normalizeEntityType(entityType: string) {
  return SERIES_ALIASES[entityType] ?? entityType
}

function getFinancialYearLabel(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const startYear = month >= 4 ? year : year - 1
  const endYear = (startYear + 1) % 100
  return `${String(startYear).slice(-2)}-${String(endYear).padStart(2, '0')}`
}

function buildCode(config: NumberSeriesConfig, nextValue: number) {
  const sep = config.separator ?? '-'
  const chunks: string[] = []
  if (config.prefix) chunks.push(config.prefix)
  if (config.include_fin_year) chunks.push(getFinancialYearLabel())
  if (config.include_month) chunks.push(String(new Date().getMonth() + 1).padStart(2, '0'))
  chunks.push(String(nextValue).padStart(config.num_digits ?? 4, '0'))
  if (config.suffix) chunks.push(config.suffix)
  return chunks.join(sep)
}

export async function generateNextCode(businessUnitId: string, entityType: string) {
  const supabase = getSupabaseClient()
  const normalizedEntityType = normalizeEntityType(entityType)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: config, error: fetchError } = await supabase
      .from('number_series_config')
      .select('id, business_unit_id, entity_type, prefix, suffix, separator, include_fin_year, include_month, num_digits, start_from, current_value, is_active')
      .eq('business_unit_id', businessUnitId)
      .eq('entity_type', normalizedEntityType)
      .eq('is_active', true)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!config) throw new Error(`Number series missing for ${normalizedEntityType}. Configure it first.`)

    const currentValue = Number(config.current_value ?? (Number(config.start_from ?? 1) - 1))
    const nextValue = currentValue + 1

    const updateQuery = supabase
      .from('number_series_config')
      .update({ current_value: nextValue, last_modified_at: new Date().toISOString() })
      .eq('id', config.id)

    const conditionedQuery = config.current_value === null
      ? updateQuery.is('current_value', null)
      : updateQuery.eq('current_value', config.current_value)

    const { data: updatedRows, error: updateError } = await conditionedQuery.select('id')

    if (updateError) throw updateError
    if ((updatedRows?.length ?? 0) > 0) {
      return { code: buildCode(config, nextValue), sequence: nextValue }
    }
  }

  throw new Error(`Could not generate a unique code for ${normalizedEntityType}. Please retry.`)
}

export async function seedDefaultNumberSeries(businessUnitId: string, entityTypes: string[]) {
  const supabase = getSupabaseClient()
  const normalizedTypes = Array.from(new Set(entityTypes.map(normalizeEntityType)))

  for (const entityType of normalizedTypes) {
    const defaults = DEFAULT_SERIES[entityType]
    if (!defaults) continue

    const { data: existing, error: lookupError } = await supabase
      .from('number_series_config')
      .select('id')
      .eq('business_unit_id', businessUnitId)
      .eq('entity_type', entityType)
      .eq('is_active', true)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (existing?.id) continue

    const { error: insertError } = await supabase.from('number_series_config').insert({
      business_unit_id: businessUnitId,
      entity_type: entityType,
      prefix: defaults.prefix,
      suffix: null,
      separator: defaults.separator,
      include_fin_year: defaults.include_fin_year,
      include_month: defaults.include_month,
      num_digits: defaults.num_digits,
      allow_manual_override: false,
      start_from: defaults.start_from,
      current_value: defaults.start_from - 1,
      reset_frequency: 'never',
      is_active: true,
      created_at: new Date().toISOString(),
    })

    if (insertError) throw insertError
  }
}





