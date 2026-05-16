'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Card from '@/components/Card'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { formatMoney } from '@/lib/transactions'

export default function CustomerPaymentDetailPage() {
  const { businessUnit } = useAuth()
  const params = useParams<{ id: string }>()
  const [row, setRow] = useState<any>(null)

  useEffect(() => { if (!businessUnit?.id || !params.id) return; void load(businessUnit.id, params.id) }, [businessUnit?.id, params.id])
  async function load(businessUnitId: string, id: string) {
    const supabase = getSupabaseClient()
    const { data } = await supabase.from('customer_payments').select('id, payment_code, payment_date, amount_paid, payment_mode, notes, invoices(invoice_no), customers(customer_name)').eq('business_unit_id', businessUnitId).eq('id', id).single()
    setRow(data)
  }
  return <>
    <PageHeader title={row?.payment_code ?? 'Customer Payment'} description={row?.customers?.customer_name ?? ''} />
    <Card>
      <p>Invoice: {row?.invoices?.invoice_no ?? '-'}</p>
      <p>Date: {row?.payment_date ?? '-'}</p>
      <p>Amount: {formatMoney(Number(row?.amount_paid ?? 0))}</p>
      <p>Mode: {row?.payment_mode ?? '-'}</p>
      <p>Notes: {row?.notes ?? '-'}</p>
    </Card>
  </>
}








