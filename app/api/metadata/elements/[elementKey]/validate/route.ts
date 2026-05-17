import { NextResponse } from 'next/server'
import { getApiContext, errorJson } from '../../../_lib'
import { validateRecord } from '@/lib/engine/data-rules'

export async function POST(request: Request, { params }: { params: Promise<{ elementKey: string }> }) {
  const ctx = await getApiContext()
  if (ctx instanceof NextResponse) return ctx
  const { orgId } = ctx
  const { elementKey } = await params
  const body = await request.json().catch(() => ({}))
  const recordData = body.recordData ?? {}
  const operation = body.operation === 'update' ? 'update' : 'insert'

  if (!elementKey) return errorJson('elementKey is required', 'VALIDATION_ERROR', 400)
  const result = await validateRecord(elementKey, recordData, orgId, operation)
  return NextResponse.json(result)
}
