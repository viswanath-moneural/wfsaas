'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import TenantSetupNotice from '@/components/layout/TenantSetupNotice'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import { useToast } from '@/lib/hooks/useToast'
import { handleSupabaseError } from '@/lib/handleSupabaseError'

export default function OpportunitiesPage() {
  const { tenant } = useAuth()
  const { error: notifyError } = useToast()
  const { canCreate } = usePermissions('crm')
  const [rows, setRows] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ opp_code: '', lead_id: '', customer_id: '', title: '', stage: 'prospecting', expected_value: '0', probability_pct: '10' })

  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: oppData, error: oppError }, { data: leadData }, { data: customerData }] = await Promise.all([
      supabase.from('opportunities').select('id, opp_code, title, stage, expected_value, probability_pct, leads(name), customers(id, customer_code, customer_name, parties(party_name), contact_roles(role_type, is_primary, contact_persons(name, phone, email)))').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('leads').select('id, lead_code, name').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('customers').select('id, customer_code, customer_name, parties(party_name), contact_roles(role_type, is_primary, contact_persons(name, phone, email))').eq('tenant_id', tenantId).eq('is_active', true).order('customer_name', { ascending: true }),
    ])
    if (oppError) setError(oppError.message)
    setRows(oppData ?? [])
    setLeads(leadData ?? [])
    setCustomers(customerData ?? [])
    setLoading(false)
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id || !canCreate) return
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('opportunities').insert({ tenant_id: tenant.id, opp_code: form.opp_code.trim(), lead_id: form.lead_id || null, customer_id: form.customer_id || null, title: form.title.trim(), stage: form.stage, expected_value: Number(form.expected_value), probability_pct: Number(form.probability_pct) }).select('id').single()
    setSaving(false)
    if (handleSupabaseError(error, notifyError)) { setError(error?.message ?? 'Failed to add opportunity.'); return }
    setForm({ opp_code: '', lead_id: '', customer_id: '', title: '', stage: 'prospecting', expected_value: '0', probability_pct: '10' })
    await load(tenant.id)
  }
  if (!tenant) return <TenantSetupNotice title="Opportunities" description="Select or create a factory before creating opportunities." />
  const columns: Column<any>[] = useMemo(() => [
    { key: 'opp_code', header: 'Opp Code' }, { key: 'title', header: 'Title' }, { key: 'customers', header: 'Customer', render: (_v, r) => r.customers?.parties?.party_name ?? r.customers?.customer_name ?? '-' }, { key: 'leads', header: 'Lead', render: (_v, r) => r.leads?.name ?? '-' }, { key: 'stage', header: 'Stage', render: (v) => <Badge variant="info">{v || '-'}</Badge> }, { key: 'expected_value', header: 'Value', align: 'right' }, { key: 'probability_pct', header: 'Prob %', align: 'right' },
  ], [])
  return <>
    <PageHeader title="Opportunities" description={`Opportunity pipeline for ${tenant.name}.`} />
    <section className="layout">
      <Card><h2>Add Opportunity</h2><form onSubmit={create}>
        <Input label="Opportunity code" value={form.opp_code} onChange={(e) => setForm((p) => ({ ...p, opp_code: e.target.value }))} required disabled={!canCreate} />
        <Input label="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required disabled={!canCreate} />
        <label><span>Customer</span><select value={form.customer_id} onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))} disabled={!canCreate}><option value="">None</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_code} - {customer.parties?.party_name ?? customer.customer_name}</option>)}</select></label>
        <label><span>Lead</span><select value={form.lead_id} onChange={(e) => setForm((p) => ({ ...p, lead_id: e.target.value }))} disabled={!canCreate}><option value="">None</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.lead_code} - {lead.name}</option>)}</select></label>
        <label><span>Stage</span><select value={form.stage} onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))} disabled={!canCreate}><option value="prospecting">prospecting</option><option value="proposal">proposal</option><option value="negotiation">negotiation</option><option value="won">won</option><option value="lost">lost</option></select></label>
        <Input label="Expected value" type="number" value={form.expected_value} onChange={(e) => setForm((p) => ({ ...p, expected_value: e.target.value }))} disabled={!canCreate} />
        <Input label="Probability %" type="number" value={form.probability_pct} onChange={(e) => setForm((p) => ({ ...p, probability_pct: e.target.value }))} disabled={!canCreate} />
        {error && <p className="form-error">{error}</p>}
        <Button title={!canCreate ? 'You do not have permission to create records.' : undefined} type="submit" loading={saving} disabled={!canCreate} fullWidth>Add opportunity</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No opportunities found" emptyMessage="Add your first opportunity." searchable searchPlaceholder="Search opportunities..." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} select{height:var(--input-height-md)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
