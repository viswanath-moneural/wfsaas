'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Card from '@/components/Card'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { formatMoney } from '@/lib/transactions'

export default function VendorPaymentDetailPage() {
  const { businessUnit } = useAuth()
  const params = useParams<{ id: string }>()
  const [row, setRow] = useState<any>(null)
  useEffect(() => { if (!businessUnit?.id || !params.id) return; void load(businessUnit.id, params.id) }, [businessUnit?.id, params.id])
  async function load(businessUnitId: string, id: string) {
    const supabase = getSupabaseClient()
    const { data } = await supabase.from('vendor_payments').select('payment_code, payment_date, amount, payment_method, notes, purchase_orders(po_code), vendors(vendor_name)').eq('business_unit_id', businessUnitId).eq('id', id).single()
    setRow(data)
  }
  return <>
    <PageHeader title={row?.payment_code ?? 'Vendor Payment'} description={row?.vendors?.vendor_name ?? ''} />
    <Card>
      <p>PO: {row?.purchase_orders?.po_code ?? '-'}</p>
      <p>Date: {row?.payment_date ?? '-'}</p>
      <p>Amount: {formatMoney(Number(row?.amount ?? 0))}</p>
      <p>Mode: {row?.payment_method ?? '-'}</p>
      <p>Notes: {row?.notes ?? '-'}</p>
    </Card>
  </>
}








