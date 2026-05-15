'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { formatMoney } from '@/lib/transactions'

export default function DashboardPage() {
  const { org, tenant } = useAuth()
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({ openSalesOrders: 0, unpaidInvoices: 0, openPos: 0, pendingGrn: 0, lowStock: 0, paymentsToday: 0 })
  const [movements, setMovements] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])

  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])

  async function load(tenantId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const today = new Date().toISOString().split('T')[0]
    const [so, inv, po, grn, stock, move, cp, vp] = await Promise.all([
      supabase.from('sales_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['draft', 'confirmed', 'dispatched']),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).not('status', 'in', '(paid,cancelled)'),
      supabase.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['draft', 'approved']),
      supabase.from('goods_receipt_notes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('quality_status', 'pending'),
      supabase.from('stock_levels').select('current_stock, material_name').eq('tenant_id', tenantId),
      supabase.from('stock_movements').select('id, movement_date, movement_type, qty, ref_table').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(8),
      supabase.from('customer_payments').select('id, payment_date, amount_paid, customers(customer_name)').eq('tenant_id', tenantId).gte('payment_date', today),
      supabase.from('vendor_payments').select('id, payment_date, amount, vendors(vendor_name)').eq('tenant_id', tenantId).gte('payment_date', today),
    ])
    const lowStock = (stock.data ?? []).filter((row: any) => Number(row.current_stock ?? 0) <= 0).length
    const combinedPayments = [...(cp.data ?? []).map((row: any) => ({ id: `c_${row.id}`, payment_date: row.payment_date, amount: row.amount_paid, party: row.customers?.customer_name ?? 'Customer', kind: 'Receipt' })), ...(vp.data ?? []).map((row: any) => ({ id: `v_${row.id}`, payment_date: row.payment_date, amount: row.amount, party: row.vendors?.vendor_name ?? 'Vendor', kind: 'Payment' }))]
    setKpis({
      openSalesOrders: so.count ?? 0,
      unpaidInvoices: inv.count ?? 0,
      openPos: po.count ?? 0,
      pendingGrn: grn.count ?? 0,
      lowStock,
      paymentsToday: combinedPayments.length,
    })
    setMovements(move.data ?? [])
    setPayments(combinedPayments.sort((a, b) => b.payment_date.localeCompare(a.payment_date)).slice(0, 8))
    setLoading(false)
  }

  const cards = useMemo(() => [
    { label: 'Open Sales Orders', value: kpis.openSalesOrders },
    { label: 'Unpaid Invoices', value: kpis.unpaidInvoices },
    { label: 'Open Purchase Orders', value: kpis.openPos },
    { label: 'Pending GRNs', value: kpis.pendingGrn },
    { label: 'Low Stock Alerts', value: kpis.lowStock },
    { label: 'Payments Today', value: kpis.paymentsToday },
  ], [kpis])

  if (!tenant) return <PageHeader title="Dashboard" description="Select a tenant to load ERP metrics." />

  return <>
    <PageHeader title="Dashboard" description={`${org?.name ?? 'Organisation'} / ${tenant.name}`} />
    <section className="cards">{cards.map((card) => <Card key={card.label}><p>{card.label}</p><strong>{card.value}</strong></Card>)}</section>
    <section className="grid">
      <DataTable columns={[{ key: 'movement_date', header: 'Date' }, { key: 'movement_type', header: 'Type' }, { key: 'qty', header: 'Qty', align: 'right' }, { key: 'ref_table', header: 'Ref', render: (v) => v || '-' }]} data={movements} loading={loading} emptyTitle="No recent movements" emptyMessage="Inventory activity will appear here." />
      <DataTable columns={[{ key: 'payment_date', header: 'Date' }, { key: 'kind', header: 'Type' }, { key: 'party', header: 'Party' }, { key: 'amount', header: 'Amount', align: 'right', render: (v) => formatMoney(Number(v ?? 0)) }]} data={payments} loading={loading} emptyTitle="No recent payments" emptyMessage="Customer and vendor payment events show here." />
    </section>
    <style jsx>{`.cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:var(--space-4);margin-bottom:var(--space-6)} p{margin:0;color:var(--text-secondary);font-size:var(--text-xs)} strong{display:block;margin-top:var(--space-2);font-size:var(--text-3xl)} .grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6)} @media(max-width:1200px){.cards{grid-template-columns:repeat(3,minmax(0,1fr))}} @media(max-width:900px){.cards,.grid{grid-template-columns:1fr}}`}</style>
  </>
}
