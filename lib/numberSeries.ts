import { getSupabaseClient } from '@/lib/supabase'

interface NumberSeriesConfig {
  id: string
  tenant_id: string
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

export async function generateNextCode(tenantId: string, entityType: string) {
  const supabase = getSupabaseClient()
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: config, error: fetchError } = await supabase
      .from('number_series_config')
      .select('id, tenant_id, entity_type, prefix, suffix, separator, include_fin_year, include_month, num_digits, start_from, current_value, is_active')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('is_active', true)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!config) throw new Error(`Number series missing for ${entityType}. Configure it first.`)

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

  throw new Error(`Could not generate a unique code for ${entityType}. Please retry.`)
}
