'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { formatMoney } from '@/lib/transactions'

export default function VendorPaymentsPage() {
  const { tenant, permissions } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [poOptions, setPoOptions] = useState<any[]>([])
  const [form, setForm] = useState({ payment_code: '', po_id: '', payment_date: new Date().toISOString().split('T')[0], amount: '0', payment_method: 'bank' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canCreate = permissions?.is_admin || permissions?.module_permissions.purchases?.can_create
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: payments }, { data: po }] = await Promise.all([
      supabase.from('vendor_payments').select('id, payment_code, payment_date, amount, purchase_orders(po_code), vendors(vendor_name)').eq('tenant_id', tenantId).order('payment_date', { ascending: false }),
      supabase.from('purchase_orders').select('id, po_code, vendor_id, vendors(vendor_name)').eq('tenant_id', tenantId).order('po_date', { ascending: false }),
    ])
    setRows(payments ?? []); setPoOptions(po ?? []); setLoading(false)
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!tenant?.id || !form.po_id) return
    if (!canCreate) { setError('You do not have permission to record vendor payments.'); return }
    setSaving(true)
    const supabase = getSupabaseClient()
    const selected = poOptions.find((item) => item.id === form.po_id)
    const { data } = await supabase.from('vendor_payments').insert({ tenant_id: tenant.id, payment_code: form.payment_code || null, po_id: form.po_id, vendor_id: selected?.vendor_id, payment_date: form.payment_date, amount: Number(form.amount), payment_method: form.payment_method }).select('id').single()
    setSaving(false); await load(tenant.id); if (data?.id) router.push(`/purchases/payments/${data.id}`)
  }
  const columns: Column<any>[] = useMemo(() => [
    { key: 'payment_code', header: 'Payment No.', render: (v) => v || '-' }, { key: 'purchase_orders', header: 'PO', render: (_v, r) => r.purchase_orders?.po_code ?? '-' }, { key: 'vendors', header: 'Vendor', render: (_v, r) => r.vendors?.vendor_name ?? '-' }, { key: 'payment_date', header: 'Date' }, { key: 'amount', header: 'Amount', align: 'right', render: (v) => formatMoney(Number(v ?? 0)) },
  ], [])
  return <>
    <PageHeader title="Vendor Payments" description="Capture vendor payments against purchase orders." />
    <section className="layout">
      <Card><h2>Record payment</h2><form onSubmit={create}>
        <Input label="Payment no." value={form.payment_code} onChange={(e) => setForm((p) => ({ ...p, payment_code: e.target.value }))} />
        <label><span>PO</span><select value={form.po_id} onChange={(e) => setForm((p) => ({ ...p, po_id: e.target.value }))}>{poOptions.map((po) => <option key={po.id} value={po.id}>{po.po_code} - {po.vendors?.vendor_name}</option>)}</select></label>
        <Input label="Date" type="date" value={form.payment_date} onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))} />
        <Input label="Amount" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate || poOptions.length === 0} fullWidth>Save payment</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} onRowClick={(row) => router.push(`/purchases/payments/${row.id}`)} emptyTitle="No vendor payments" emptyMessage="Record a payment for vendor settlement." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
