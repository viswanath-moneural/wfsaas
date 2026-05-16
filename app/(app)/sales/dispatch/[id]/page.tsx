'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Card from '@/components/Card'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'

export default function DispatchDetailPage() {
  const { businessUnit } = useAuth()
  const params = useParams<{ id: string }>()
  const [row, setRow] = useState<any>(null)
  useEffect(() => { if (!businessUnit?.id || !params.id) return; void load(businessUnit.id, params.id) }, [businessUnit?.id, params.id])
  async function load(businessUnitId: string, id: string) {
    const supabase = getSupabaseClient()
    const { data } = await supabase.from('dispatch_orders').select('do_code, dispatch_date, vehicle_no, driver_name, status, sales_orders(so_code), customers(customer_name)').eq('business_unit_id', businessUnitId).eq('id', id).single()
    setRow(data)
  }
  return <>
    <PageHeader title={row?.do_code ?? 'Dispatch'} description={row?.customers?.customer_name ?? ''} />
    <Card>
      <p>Order: {row?.sales_orders?.so_code ?? '-'}</p>
      <p>Date: {row?.dispatch_date ?? '-'}</p>
      <p>Vehicle: {row?.vehicle_no ?? '-'}</p>
      <p>Driver: {row?.driver_name ?? '-'}</p>
      <p>Status: {row?.status ?? '-'}</p>
    </Card>
  </>
}








