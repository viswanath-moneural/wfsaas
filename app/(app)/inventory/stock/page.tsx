'use client'

import { useEffect, useMemo, useState } from 'react'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'

export default function StockLevelsPage() {
  const { tenant } = useAuth()
  const [rmRows, setRmRows] = useState<any[]>([])
  const [fgRows, setFgRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: rm }, { data: fg }] = await Promise.all([
      supabase.from('stock_levels').select('material_code, material_name, current_stock, default_unit').eq('tenant_id', tenantId).order('material_code', { ascending: true }),
      supabase.from('finished_goods_stock').select('product_code, product_name, current_stock').eq('tenant_id', tenantId).order('product_code', { ascending: true }),
    ])
    setRmRows(rm ?? []); setFgRows(fg ?? []); setLoading(false)
  }
  const rmColumns: Column<any>[] = useMemo(() => [{ key: 'material_code', header: 'Material Code' }, { key: 'material_name', header: 'Material' }, { key: 'current_stock', header: 'Stock', align: 'right' }, { key: 'default_unit', header: 'Unit' }], [])
  const fgColumns: Column<any>[] = useMemo(() => [{ key: 'product_code', header: 'Product Code' }, { key: 'product_name', header: 'Product' }, { key: 'current_stock', header: 'Stock', align: 'right' }], [])
  return <>
    <PageHeader title="Stock Levels" description="Read-only inventory balances for raw materials and finished goods." />
    <DataTable columns={rmColumns} data={rmRows} loading={loading} emptyTitle="No raw material stock" emptyMessage="Stock ledger entries will populate balances." />
    <div style={{ height: '16px' }} />
    <DataTable columns={fgColumns} data={fgRows} loading={loading} emptyTitle="No finished goods stock" emptyMessage="Production and dispatch entries will populate balances." />
  </>
}
