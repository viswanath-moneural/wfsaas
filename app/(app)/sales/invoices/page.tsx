'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Badge, { STATUS_BADGE } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { calcInvoiceTotals } from '@/lib/transactions'
import { generateNextCode } from '@/lib/numberSeries'
import TenantSetupNotice from '@/components/layout/TenantSetupNotice'

interface Row { id: string; invoice_no: string; invoice_date: string; status: string | null; total_amount: number | null; sales_orders: { so_code: string } | null; customers: { customer_name: string } | null }
interface OrderOption { id: string; so_code: string; customer_id: string; status: string | null; customers: { customer_name: string } | null }

export default function SalesInvoicesPage() {
  const { tenant, permissions } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [form, setForm] = useState({ so_id: '', invoice_date: new Date().toISOString().split('T')[0], due_date: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canCreate = permissions?.is_admin || permissions?.module_permissions.sales?.can_create

  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void fetchData(tenant.id) }, [tenant?.id])

  async function fetchData(tenantId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const [{ data: invoices }, { data: so }] = await Promise.all([
      supabase.from('invoices').select('id, invoice_no, invoice_date, status, total_amount, sales_orders(so_code), customers(customer_name)').eq('tenant_id', tenantId).order('invoice_date', { ascending: false }),
      supabase.from('sales_orders').select('id, so_code, customer_id, status, customers(customer_name)').eq('tenant_id', tenantId).order('order_date', { ascending: false }),
    ])
    setRows((invoices as unknown as Row[]) ?? [])
    setOrders((so as unknown as OrderOption[]) ?? [])
    setLoading(false)
  }

  async function createInvoice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tenant?.id || !form.so_id) return
    if (!canCreate) {
      setError('You do not have permission to create invoices.')
      return
    }
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const { data: lines } = await supabase.from('sales_order_items').select('ordered_qty, unit_price, discount_pct').eq('so_id', form.so_id)
    const totals = calcInvoiceTotals((lines ?? []).map((line: any) => ({ qty: Number(line.ordered_qty), unit_price: Number(line.unit_price), discount_pct: Number(line.discount_pct ?? 0), gst_rate: 0 })))
    const selected = orders.find((row) => row.id === form.so_id)
    const selectedOrder = orders.find((row) => row.id === form.so_id)
    if (selectedOrder && !['confirmed', 'dispatched', 'invoiced'].includes((selectedOrder as any).status ?? 'draft')) {
      setSaving(false)
      setError('Invoice can only be created for confirmed or dispatched orders.')
      return
    }
    let invoiceNo = ''
    try {
      invoiceNo = (await generateNextCode(tenant.id, 'invoice')).code
    } catch (seriesError: any) {
      setSaving(false)
      setError(`${seriesError.message} Configure Number Series in Configuration.`)
      return
    }
    const { data: inserted, error: insertError } = await supabase.from('invoices').insert({
      tenant_id: tenant.id, invoice_no: invoiceNo, so_id: form.so_id, customer_id: selected?.customer_id, invoice_date: form.invoice_date,
      due_date: form.due_date || null, subtotal: totals.subtotal, discount_amt: totals.discount, taxable_value: totals.taxable, total_amount: totals.total, status: 'draft',
    }).select('id').single()
    if (insertError) { setError(insertError.message); setSaving(false); return }
    await supabase.from('sales_orders').update({ status: 'invoiced' }).eq('tenant_id', tenant.id).eq('id', form.so_id)
    setSaving(false)
    await fetchData(tenant.id)
    if (inserted?.id) router.push(`/sales/invoices/${inserted.id}`)
  }

  const columns: Column<Row>[] = useMemo(() => [
    { key: 'invoice_no', header: 'Invoice' },
    { key: 'sales_orders', header: 'Order', render: (_v, r) => r.sales_orders?.so_code ?? '-' },
    { key: 'customers', header: 'Customer', render: (_v, r) => r.customers?.customer_name ?? '-' },
    { key: 'invoice_date', header: 'Date' },
    { key: 'total_amount', header: 'Total', align: 'right', render: (v) => Number(v ?? 0).toFixed(2) },
    { key: 'status', header: 'Status', render: (v) => <Badge variant={STATUS_BADGE[String(v ?? 'draft')] ?? 'default'}>{String(v ?? 'draft')}</Badge> },
  ], [])

  if (!tenant) return <TenantSetupNotice title="Invoices" description="Select or create a factory before creating invoices." />

  return <>
    <PageHeader title="Invoices" description="Create invoices from sales orders and track payment state." />
    <section className="layout">
      <Card><h2>Create Invoice</h2><form onSubmit={createInvoice}>
        <Input label="Invoice number" value="Auto-generated from Number Series" disabled />
        <label><span>Sales order</span><select value={form.so_id} onChange={(e) => setForm((p) => ({ ...p, so_id: e.target.value }))} required>{orders.map((order) => <option key={order.id} value={order.id}>{order.so_code} - {order.customers?.customer_name}</option>)}</select></label>
        <Input label="Invoice date" type="date" value={form.invoice_date} onChange={(e) => setForm((p) => ({ ...p, invoice_date: e.target.value }))} required />
        <Input label="Due date" type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate || orders.length === 0} fullWidth>Create invoice</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} onRowClick={(row) => router.push(`/sales/invoices/${row.id}`)} emptyTitle="No invoices found" emptyMessage="Create invoice from a sales order." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} h2{margin:0 0 var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} select{height:var(--input-height-md)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
