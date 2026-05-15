'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DataTable, { type Column } from '@/components/DataTable'
import Card from '@/components/Card'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { formatMoney } from '@/lib/transactions'
import { generateNextCode } from '@/lib/numberSeries'
import TenantSetupNotice from '@/components/layout/TenantSetupNotice'

interface PaymentRow { id: string; payment_code: string | null; payment_date: string; amount_paid: number; invoices: { invoice_no: string } | null; customers: { customer_name: string } | null }
interface InvoiceOption { id: string; invoice_no: string; customer_id: string; status: string | null; customers: { customer_name: string } | null }

export default function CustomerPaymentsPage() {
  const { tenant, permissions } = useAuth()
  const router = useRouter()
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceOption[]>([])
  const [form, setForm] = useState({ invoice_id: '', payment_date: new Date().toISOString().split('T')[0], amount_paid: '0', payment_mode: 'bank' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canCreate = permissions?.is_admin || permissions?.module_permissions.sales?.can_create

  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void fetchData(tenant.id) }, [tenant?.id])
  async function fetchData(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: pay }, { data: inv }] = await Promise.all([
      supabase.from('customer_payments').select('id, payment_code, payment_date, amount_paid, invoices(invoice_no), customers(customer_name)').eq('tenant_id', tenantId).order('payment_date', { ascending: false }),
      supabase.from('invoices').select('id, invoice_no, customer_id, status, customers(customer_name)').eq('tenant_id', tenantId).order('invoice_date', { ascending: false }),
    ])
    setRows((pay as unknown as PaymentRow[]) ?? [])
    setInvoices((inv as unknown as InvoiceOption[]) ?? [])
    setLoading(false)
  }

  async function createPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tenant?.id || !form.invoice_id) return
    if (!canCreate) {
      setError('You do not have permission to record customer payments.')
      return
    }
    setSaving(true)
    const supabase = getSupabaseClient()
    const selected = invoices.find((row) => row.id === form.invoice_id)
    if (selected?.status === 'cancelled') {
      setSaving(false)
      setError('Cannot post payment against cancelled invoice.')
      return
    }
    let paymentCode = ''
    try {
      paymentCode = (await generateNextCode(tenant.id, 'customer_payment')).code
    } catch (seriesError: any) {
      setSaving(false)
      setError(`${seriesError.message} Configure Number Series in Configuration.`)
      return
    }
    await supabase.from('customer_payments').insert({ tenant_id: tenant.id, payment_code: paymentCode, invoice_id: form.invoice_id, customer_id: selected?.customer_id, payment_date: form.payment_date, amount_paid: Number(form.amount_paid), payment_mode: form.payment_mode })
    const { data: allPayments } = await supabase.from('customer_payments').select('amount_paid').eq('invoice_id', form.invoice_id)
    const paid = (allPayments ?? []).reduce((sum: number, row: any) => sum + Number(row.amount_paid ?? 0), 0)
    const { data: invoice } = await supabase.from('invoices').select('total_amount').eq('id', form.invoice_id).single()
    const invoiceTotal = Number((invoice as any)?.total_amount ?? 0)
    const status = paid >= invoiceTotal ? 'paid' : 'partial'
    await supabase.from('invoices').update({ status }).eq('id', form.invoice_id)
    setSaving(false)
    await fetchData(tenant.id)
  }

  const columns: Column<PaymentRow>[] = useMemo(() => [
    { key: 'payment_code', header: 'Payment No.', render: (v) => v || '-' },
    { key: 'invoices', header: 'Invoice', render: (_v, r) => r.invoices?.invoice_no ?? '-' },
    { key: 'customers', header: 'Customer', render: (_v, r) => r.customers?.customer_name ?? '-' },
    { key: 'payment_date', header: 'Date' },
    { key: 'amount_paid', header: 'Amount', align: 'right', render: (v) => formatMoney(Number(v ?? 0)) },
  ], [])

  if (!tenant) return <TenantSetupNotice title="Customer Payments" description="Select or create a factory before recording payments." />

  return <>
    <PageHeader title="Customer Payments" description="Track receipts against sales invoices." />
    <section className="layout">
      <Card><h2>Record payment</h2><form onSubmit={createPayment}>
        <Input label="Payment code" value="Auto-generated from Number Series" disabled />
        <label><span>Invoice</span><select value={form.invoice_id} onChange={(e) => setForm((p) => ({ ...p, invoice_id: e.target.value }))}>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_no} - {invoice.customers?.customer_name}</option>)}</select></label>
        <Input label="Date" type="date" value={form.payment_date} onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))} required />
        <Input label="Amount" type="number" min="0" step="0.01" value={form.amount_paid} onChange={(e) => setForm((p) => ({ ...p, amount_paid: e.target.value }))} required />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate || invoices.length === 0} fullWidth>Save payment</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} onRowClick={(row) => router.push(`/sales/payments/${row.id}`)} emptyTitle="No payments found" emptyMessage="Record customer payments against invoices." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
