'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import BusinessUnitSetupNotice from '@/components/layout/BusinessUnitSetupNotice'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import { useToast } from '@/lib/hooks/useToast'
import { handleSupabaseError } from '@/lib/handleSupabaseError'

export default function QuotesPage() {
  const { businessUnit } = useAuth()
  const { error: notifyError } = useToast()
  const { canCreate } = usePermissions('crm')
  const [rows, setRows] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ quote_code: '', customer_id: '', quote_date: new Date().toISOString().split('T')[0], valid_until: '', status: 'draft', notes: '' })
  useEffect(() => { if (!businessUnit?.id) { setLoading(false); return } ; void load(businessUnit.id) }, [businessUnit?.id])
  async function load(businessUnitId: string) {
    const supabase = getSupabaseClient()
    const [{ data: quoteData, error: quoteError }, { data: customerData }] = await Promise.all([
      supabase.from('quotes').select('id, quote_code, quote_date, valid_until, status, customers(id, customer_code, customer_name, parties(party_name), contact_roles(role_type, is_primary, contact_persons(name, phone, email)))').eq('business_unit_id', businessUnitId).order('created_at', { ascending: false }),
      supabase.from('customers').select('id, customer_code, customer_name, parties(party_name), contact_roles(role_type, is_primary, contact_persons(name, phone, email))').eq('business_unit_id', businessUnitId).eq('is_active', true).order('customer_name', { ascending: true }),
    ])
    if (quoteError) setError(quoteError.message)
    setRows(quoteData ?? [])
    setCustomers(customerData ?? [])
    setLoading(false)
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!businessUnit?.id || !canCreate) return
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('quotes').insert({ business_unit_id: businessUnit.id, quote_code: form.quote_code.trim(), customer_id: form.customer_id || null, quote_date: form.quote_date, valid_until: form.valid_until || null, status: form.status, notes: form.notes.trim() || null }).select('id').single()
    setSaving(false)
    if (handleSupabaseError(error, notifyError)) { setError(error?.message ?? 'Failed to create quote.'); return }
    setForm({ quote_code: '', customer_id: '', quote_date: new Date().toISOString().split('T')[0], valid_until: '', status: 'draft', notes: '' })
    await load(businessUnit.id)
  }
  if (!businessUnit) return <BusinessUnitSetupNotice title="Quotes" description="Select or create a businessUnit before creating quotes." />
  const columns: Column<any>[] = useMemo(() => [
    { key: 'quote_code', header: 'Quote No.' }, { key: 'customers', header: 'Customer', render: (_v, r) => r.customers?.parties?.party_name ?? r.customers?.customer_name ?? '-' }, { key: 'primary_contact', header: 'Contact', render: (_v, r) => {
      const primary = r.customers?.contact_roles?.find((role: any) => role.is_primary) ?? r.customers?.contact_roles?.[0]
      return primary?.contact_persons?.name ?? '-'
    } }, { key: 'quote_date', header: 'Date' }, { key: 'valid_until', header: 'Valid Till', render: (v) => v || '-' }, { key: 'status', header: 'Status', render: (v) => <Badge variant="info">{v || '-'}</Badge> },
  ], [])
  return <>
    <PageHeader title="Quotes" description={`Quotes for ${businessUnit.name}.`} />
    <section className="layout">
      <Card><h2>Create Quote</h2><form onSubmit={create}>
        <Input label="Quote code" value={form.quote_code} onChange={(e) => setForm((p) => ({ ...p, quote_code: e.target.value }))} required disabled={!canCreate} />
        <label><span>Customer</span><select value={form.customer_id} onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))} disabled={!canCreate}><option value="">None</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_code} - {customer.parties?.party_name ?? customer.customer_name}</option>)}</select></label>
        <Input label="Quote date" type="date" value={form.quote_date} onChange={(e) => setForm((p) => ({ ...p, quote_date: e.target.value }))} disabled={!canCreate} />
        <Input label="Valid until" type="date" value={form.valid_until} onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value }))} disabled={!canCreate} />
        <label><span>Status</span><select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} disabled={!canCreate}><option value="draft">draft</option><option value="sent">sent</option><option value="accepted">accepted</option><option value="rejected">rejected</option></select></label>
        <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} disabled={!canCreate} />
        {error && <p className="form-error">{error}</p>}
        <Button title={!canCreate ? 'You do not have permission to create records.' : undefined} type="submit" loading={saving} disabled={!canCreate} fullWidth>Create quote</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No quotes found" emptyMessage="Create your first quote." searchable searchPlaceholder="Search quotes..." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} select{height:var(--input-height-md)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}









