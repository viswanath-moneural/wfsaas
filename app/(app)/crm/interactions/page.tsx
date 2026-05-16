'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import BusinessUnitSetupNotice from '@/components/layout/BusinessUnitSetupNotice'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import { useToast } from '@/lib/hooks/useToast'
import { handleSupabaseError } from '@/lib/handleSupabaseError'

export default function InteractionsPage() {
  const { businessUnit, user } = useAuth()
  const { error: notifyError } = useToast()
  const { canCreate } = usePermissions('crm')
  const [rows, setRows] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ customer_id: '', type: 'call', summary: '', details: '' })
  useEffect(() => { if (!businessUnit?.id) { setLoading(false); return } ; void load(businessUnit.id) }, [businessUnit?.id])
  async function load(businessUnitId: string) {
    const supabase = getSupabaseClient()
    const [{ data: intData, error: intError }, { data: customerData }] = await Promise.all([
      supabase.from('interactions').select('id, type, summary, interaction_at, customers(id, customer_code, customer_name, parties(party_name), contact_roles(role_type, is_primary, contact_persons(name, phone, email)))').eq('business_unit_id', businessUnitId).order('interaction_at', { ascending: false }),
      supabase.from('customers').select('id, customer_code, customer_name, parties(party_name), contact_roles(role_type, is_primary, contact_persons(name, phone, email))').eq('business_unit_id', businessUnitId).eq('is_active', true).order('customer_name', { ascending: true }),
    ])
    if (intError) setError(intError.message)
    setRows(intData ?? [])
    setCustomers(customerData ?? [])
    setLoading(false)
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!businessUnit?.id || !canCreate) return
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('interactions').insert({ business_unit_id: businessUnit.id, customer_id: form.customer_id || null, type: form.type, summary: form.summary.trim(), details: form.details.trim() || null, logged_by: user?.id ?? null, interaction_at: new Date().toISOString() }).select('id').single()
    setSaving(false)
    if (handleSupabaseError(error, notifyError)) { setError(error?.message ?? 'Failed to save interaction.'); return }
    setForm({ customer_id: '', type: 'call', summary: '', details: '' })
    await load(businessUnit.id)
  }
  if (!businessUnit) return <BusinessUnitSetupNotice title="Interactions" description="Select or create a businessUnit before logging interactions." />
  const columns: Column<any>[] = useMemo(() => [
    { key: 'interaction_at', header: 'When' }, { key: 'type', header: 'Type' }, { key: 'customers', header: 'Customer', render: (_v, r) => r.customers?.parties?.party_name ?? r.customers?.customer_name ?? '-' }, { key: 'primary_contact', header: 'Contact', render: (_v, r) => {
      const primary = r.customers?.contact_roles?.find((role: any) => role.is_primary) ?? r.customers?.contact_roles?.[0]
      return primary?.contact_persons?.name ?? '-'
    } }, { key: 'summary', header: 'Summary' },
  ], [])
  return <>
    <PageHeader title="Interactions" description={`Interaction log for ${businessUnit.name}.`} />
    <section className="layout">
      <Card><h2>Log Interaction</h2><form onSubmit={create}>
        <label><span>Customer</span><select value={form.customer_id} onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))} disabled={!canCreate}><option value="">None</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_code} - {customer.parties?.party_name ?? customer.customer_name}</option>)}</select></label>
        <label><span>Type</span><select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} disabled={!canCreate}><option value="call">call</option><option value="meeting">meeting</option><option value="email">email</option><option value="message">message</option></select></label>
        <Input label="Summary" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} required disabled={!canCreate} />
        <Input label="Details" value={form.details} onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))} disabled={!canCreate} />
        {error && <p className="form-error">{error}</p>}
        <Button title={!canCreate ? 'You do not have permission to create records.' : undefined} type="submit" loading={saving} disabled={!canCreate} fullWidth>Save interaction</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No interactions found" emptyMessage="Log your first interaction." searchable searchPlaceholder="Search interactions..." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} select{height:var(--input-height-md)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}









