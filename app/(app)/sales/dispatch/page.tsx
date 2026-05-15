'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge, { STATUS_BADGE } from '@/components/ui/Badge'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'

interface Row { id: string; do_code: string; dispatch_date: string; status: string | null; sales_orders: { so_code: string } | null; customers: { customer_name: string } | null }
interface OrderOption { id: string; so_code: string; customer_id: string; status: string | null; customers: { customer_name: string } | null }

export default function DispatchPage() {
  const { tenant, permissions } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [form, setForm] = useState({ do_code: '', so_id: '', dispatch_date: new Date().toISOString().split('T')[0], vehicle_no: '', driver_name: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canCreate = permissions?.is_admin || permissions?.module_permissions.sales?.can_create

  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void fetchData(tenant.id) }, [tenant?.id])
  async function fetchData(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: dispatches }, { data: so }] = await Promise.all([
      supabase.from('dispatch_orders').select('id, do_code, dispatch_date, status, sales_orders(so_code), customers(customer_name)').eq('tenant_id', tenantId).order('dispatch_date', { ascending: false }),
      supabase.from('sales_orders').select('id, so_code, customer_id, status, customers(customer_name)').eq('tenant_id', tenantId).order('order_date', { ascending: false }),
    ])
    setRows((dispatches as unknown as Row[]) ?? [])
    setOrders((so as unknown as OrderOption[]) ?? [])
    setLoading(false)
  }
  async function createDispatch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!tenant?.id || !form.so_id) return
    if (!canCreate) { setError('You do not have permission to create dispatch orders.'); return }
    setSaving(true)
    const supabase = getSupabaseClient()
    const selected = orders.find((row) => row.id === form.so_id)
    if (selected && !['confirmed', 'dispatched'].includes(selected.status ?? 'draft')) {
      setSaving(false)
      setError('Dispatch can only be created for confirmed sales orders.')
      return
    }
    await supabase.from('dispatch_orders').insert({ tenant_id: tenant.id, do_code: form.do_code, so_id: form.so_id, customer_id: selected?.customer_id, dispatch_date: form.dispatch_date, vehicle_no: form.vehicle_no || null, driver_name: form.driver_name || null, status: 'draft' })
    await supabase.from('sales_orders').update({ status: 'dispatched' }).eq('tenant_id', tenant.id).eq('id', form.so_id)
    setSaving(false); await fetchData(tenant.id)
  }

  const columns: Column<Row>[] = useMemo(() => [
    { key: 'do_code', header: 'Dispatch No.' },
    { key: 'sales_orders', header: 'Order', render: (_v, r) => r.sales_orders?.so_code ?? '-' },
    { key: 'customers', header: 'Customer', render: (_v, r) => r.customers?.customer_name ?? '-' },
    { key: 'dispatch_date', header: 'Date' },
    { key: 'status', header: 'Status', render: (v) => <Badge variant={STATUS_BADGE[String(v ?? 'draft')] ?? 'default'}>{String(v ?? 'draft')}</Badge> },
  ], [])

  return <>
    <PageHeader title="Dispatch" description="Create minimal dispatch headers from sales orders." />
    <section className="layout">
      <Card><h2>Create dispatch</h2><form onSubmit={createDispatch}>
        <Input label="Dispatch no." value={form.do_code} onChange={(e) => setForm((p) => ({ ...p, do_code: e.target.value }))} required />
        <label><span>Sales order</span><select value={form.so_id} onChange={(e) => setForm((p) => ({ ...p, so_id: e.target.value }))}>{orders.map((order) => <option key={order.id} value={order.id}>{order.so_code} - {order.customers?.customer_name}</option>)}</select></label>
        <Input label="Dispatch date" type="date" value={form.dispatch_date} onChange={(e) => setForm((p) => ({ ...p, dispatch_date: e.target.value }))} required />
        <Input label="Vehicle no." value={form.vehicle_no} onChange={(e) => setForm((p) => ({ ...p, vehicle_no: e.target.value }))} />
        <Input label="Driver name" value={form.driver_name} onChange={(e) => setForm((p) => ({ ...p, driver_name: e.target.value }))} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate || orders.length === 0} fullWidth>Create dispatch</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} onRowClick={(row) => router.push(`/sales/dispatch/${row.id}`)} emptyTitle="No dispatches" emptyMessage="Create dispatch document from an order." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
