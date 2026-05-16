import 'server-only'

import { createAdminClient } from '@/lib/supabase/adminClient'

export interface NextDocumentNumberResult {
  code: string
  seriesId: string
}

export async function getNextDocumentNumber(org_id: string, business_unit_id: string | null | undefined, document_type: string): Promise<NextDocumentNumberResult> {
  const admin = createAdminClient()
  let query = admin
    .from('number_series')
    .select('id, business_unit_id')
    .eq('org_id', org_id)
    .eq('document_type', document_type)
    .eq('is_active', true)
    .order('business_unit_id', { ascending: false, nullsFirst: false })
    .limit(1)

  query = business_unit_id
    ? query.or(`business_unit_id.eq.${business_unit_id},business_unit_id.is.null`)
    : query.is('business_unit_id', null)

  const { data: seriesRows, error: lookupError } = await query
  if (lookupError) throw lookupError

  const series = business_unit_id
    ? (seriesRows ?? []).find((row: any) => row.business_unit_id === business_unit_id) ?? (seriesRows ?? [])[0]
    : (seriesRows ?? [])[0]

  if (!series?.id) throw new Error(`Number series missing for ${document_type}. Configure it in Administration > Number Series.`)

  const { data, error } = await admin.rpc('get_next_number', { p_series_id: series.id })
  if (error) throw error

  return { code: String(data), seriesId: series.id }
}





