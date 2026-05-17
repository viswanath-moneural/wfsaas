import { NextResponse } from 'next/server'
import { getApiContext, errorJson } from '@/app/api/metadata/_lib'
import { validateRecord } from '@/lib/engine/data-rules'

async function resolveElementTable(supabase: any, orgId: string, businessUnitId: string, elementKey: string) {
  const { data, error } = await supabase
    .from('element_definitions')
    .select('table_name')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .maybeSingle()
  if (error) throw error
  if (!data?.table_name) throw new Error('Element table not found.')
  return data.table_name
}

export async function GET(_: Request, { params }: { params: Promise<{ elementKey: string; recordId: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey, recordId } = await params
  const table = await resolveElementTable(supabase, orgId, businessUnitId, elementKey)
  const { data, error } = await supabase.from(table).select('*').eq('id', recordId).eq('business_unit_id', businessUnitId).maybeSingle()
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  if (!data) return errorJson('Record not found', 'NOT_FOUND', 404)
  return NextResponse.json({ record: data })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ elementKey: string; recordId: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey, recordId } = await params
  const table = await resolveElementTable(supabase, orgId, businessUnitId, elementKey)
  const body = await request.json().catch(() => ({}))
  const recordData = body.recordData ?? {}
  const validation = await validateRecord(elementKey, recordData, orgId, 'update')
  if (!validation.valid) return NextResponse.json(validation, { status: 400 })
  const { data, error } = await supabase
    .from(table)
    .update(recordData)
    .eq('id', recordId)
    .eq('business_unit_id', businessUnitId)
    .select('*')
    .maybeSingle()
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  if (!data) return errorJson('Record not found', 'NOT_FOUND', 404)
  return NextResponse.json({ record: data })
}
