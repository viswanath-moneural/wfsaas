'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Badge, { STATUS_BADGE } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import { calcInvoiceTotals, canTransitionSalesStatus, formatMoney } from '@/lib/transactions'

interface Item { id: string; qty: number; unit_price: number; discount_pct: number | null; gst_rate: number | null; products: { product_code: string; product_name: string } | null }
interface Invoice { id: string; invoice_no: string; invoice_date: string; status: string | null; customers: { customer_name: string } | null }

export default function InvoiceDetailPage() {
  const { tenant } = useAuth()
  const params = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('draft')
  const [error, setError] = useState('')
  const { canEdit: canUpdate } = usePermissions('sales')

  useEffect(() => { if (!tenant?.id || !params.id) { setLoading(false); return } ; void fetchData(tenant.id, params.id) }, [tenant?.id, params.id])

  async function fetchData(tenantId: string, id: string) {
    const supabase = getSupabaseClient()
    const [{ data: inv }, { data: lines }] = await Promise.all([
      supabase.from('invoices').select('id, invoice_no, invoice_date, status, customers(customer_name)').eq('tenant_id', tenantId).eq('id', id).single(),
      supabase.from('invoice_items').select('id, qty, unit_price, discount_pct, gst_rate, products(product_code, product_name)').eq('invoice_id', id).order('sort_order', { ascending: true }),
    ])
    setInvoice((inv as unknown as Invoice) ?? null)
    setStatus((inv as any)?.status ?? 'draft')
    setItems((lines as unknown as Item[]) ?? [])
    setLoading(false)
  }

  async function saveStatus() {
    if (!tenant?.id || !invoice?.id) return
    if (!canUpdate) return
    if (!canTransitionSalesStatus(invoice.status, status)) {
      setError(`Invalid status transition from ${invoice.status ?? 'draft'} to ${status}.`)
      return
    }
    const supabase = getSupabaseClient()
    await supabase.from('invoices').update({ status }).eq('tenant_id', tenant.id).eq('id', invoice.id)
    if (status === 'paid') await supabase.from('sales_orders').update({ status: 'paid' }).eq('tenant_id', tenant.id).eq('id', (invoice as any).so_id)
    await fetchData(tenant.id, invoice.id)
  }

  const totals = useMemo(() => calcInvoiceTotals(items.map((item) => ({ qty: Number(item.qty), unit_price: Number(item.unit_price), discount_pct: Number(item.discount_pct ?? 0), gst_rate: Number(item.gst_rate ?? 0) }))), [items])
  const columns: Column<Item>[] = [
    { key: 'products', header: 'Product', render: (_v, row) => row.products ? `${row.products.product_code} - ${row.products.product_name}` : '-' },
    { key: 'qty', header: 'Qty', align: 'right' },
    { key: 'unit_price', header: 'Rate', align: 'right', render: (v) => formatMoney(Number(v ?? 0)) },
    { key: 'discount_pct', header: 'Disc %', align: 'right', render: (v) => Number(v ?? 0).toFixed(2) },
  ]

  if (loading) return <PageHeader title="Invoice" description="Loading..." />
  return <>
    <PageHeader title={invoice?.invoice_no ?? 'Invoice'} description={invoice?.customers?.customer_name ?? ''} />
    <section className="top">
      <Card><div className="row"><span>Date</span><strong>{invoice?.invoice_date}</strong></div><div className="row"><span>Status</span><Badge variant={STATUS_BADGE[String(invoice?.status ?? 'draft')] ?? 'default'}>{invoice?.status ?? 'draft'}</Badge></div></Card>
      <Card><h2>Status</h2><div className="actions"><select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canUpdate}>{['draft', 'confirmed', 'invoiced', 'paid', 'cancelled', 'partial'].map((option) => <option key={option} value={option} disabled={!canTransitionSalesStatus(invoice?.status, option) && option !== 'partial'}>{option}</option>)}</select><Button title={!canUpdate ? 'You do not have permission to update records.' : undefined} onClick={saveStatus} disabled={!canUpdate}>Save</Button></div>{error && <p className="form-error">{error}</p>}</Card>
    </section>
    <DataTable columns={columns} data={items} emptyTitle="No items" emptyMessage="Add line items directly in Supabase or next enhancement." />
    <Card className="totals"><p>Subtotal: {formatMoney(totals.subtotal)}</p><p>Discount: {formatMoney(totals.discount)}</p><p>Total: {formatMoney(totals.total)}</p></Card>
    <style jsx>{`.top{display:grid;grid-template-columns:1fr 340px;gap:var(--space-6);margin-bottom:var(--space-6)} .row{display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-2)} .actions{display:flex;gap:var(--space-2)} select{height:var(--input-height-md);width:100%} .form-error{margin:var(--space-2) 0 0;color:var(--text-danger)} .totals{margin-top:var(--space-4)} p{margin:0 0 var(--space-2)} @media(max-width:900px){.top{grid-template-columns:1fr}}`}</style>
  </>
}
