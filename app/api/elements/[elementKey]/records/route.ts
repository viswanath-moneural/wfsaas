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

export async function GET(request: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey } = await params
  const table = await resolveElementTable(supabase, orgId, businessUnitId, elementKey)

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get('limit') ?? '25')
  const page = Number(url.searchParams.get('page') ?? '1')
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase.from(table).select('*').eq('business_unit_id', businessUnitId).range(from, to)
  for (const [key, value] of url.searchParams.entries()) {
    if (['limit', 'page'].includes(key)) continue
    query = query.eq(key, value)
  }

  const { data, error } = await query
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  return NextResponse.json({ records: data ?? [] })
}

export async function POST(request: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { supabase, orgId, businessUnitId } = ctx
  const { elementKey } = await params
  const table = await resolveElementTable(supabase, orgId, businessUnitId, elementKey)
  const body = await request.json().catch(() => ({}))
  const recordData = body.recordData ?? {}

  const validation = await validateRecord(elementKey, recordData, orgId, 'insert')
  if (!validation.valid) return NextResponse.json(validation, { status: 400 })

  const { data, error } = await supabase
    .from(table)
    .insert({ ...recordData, business_unit_id: businessUnitId })
    .select('*')
    .single()
  if (error) return errorJson(error.message, 'DB_ERROR', 500)
  return NextResponse.json({ record: data }, { status: 201 })
}
