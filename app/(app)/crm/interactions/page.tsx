'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import TenantSetupNotice from '@/components/layout/TenantSetupNotice'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'

export default function InteractionsPage() {
  const { tenant, user, permissions } = useAuth()
  const canCreate = permissions?.is_admin || permissions?.module_permissions.crm?.can_create
  const [rows, setRows] = useState<any[]>([])
  const [parties, setParties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ party_id: '', type: 'call', summary: '', details: '' })
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: intData, error: intError }, { data: partyData }] = await Promise.all([
      supabase.from('interactions').select('id, type, summary, interaction_at, parties(party_name)').eq('tenant_id', tenantId).order('interaction_at', { ascending: false }),
      supabase.from('parties').select('id, party_name').eq('tenant_id', tenantId).eq('is_active', true).order('party_name', { ascending: true }),
    ])
    if (intError) setError(intError.message)
    setRows(intData ?? [])
    setParties(partyData ?? [])
    setLoading(false)
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id || !canCreate) return
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const { error: insertError } = await supabase.from('interactions').insert({ tenant_id: tenant.id, party_id: form.party_id || null, type: form.type, summary: form.summary.trim(), details: form.details.trim() || null, logged_by: user?.id ?? null, interaction_at: new Date().toISOString() })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setForm({ party_id: '', type: 'call', summary: '', details: '' })
    await load(tenant.id)
  }
  if (!tenant) return <TenantSetupNotice title="Interactions" description="Select or create a factory before logging interactions." />
  const columns: Column<any>[] = useMemo(() => [
    { key: 'interaction_at', header: 'When' }, { key: 'type', header: 'Type' }, { key: 'parties', header: 'Party', render: (_v, r) => r.parties?.party_name ?? '-' }, { key: 'summary', header: 'Summary' },
  ], [])
  return <>
    <PageHeader title="Interactions" description={`Interaction log for ${tenant.name}.`} />
    <section className="layout">
      <Card><h2>Log Interaction</h2><form onSubmit={create}>
        <label><span>Party</span><select value={form.party_id} onChange={(e) => setForm((p) => ({ ...p, party_id: e.target.value }))} disabled={!canCreate}><option value="">None</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.party_name}</option>)}</select></label>
        <label><span>Type</span><select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} disabled={!canCreate}><option value="call">call</option><option value="meeting">meeting</option><option value="email">email</option><option value="message">message</option></select></label>
        <Input label="Summary" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} required disabled={!canCreate} />
        <Input label="Details" value={form.details} onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))} disabled={!canCreate} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate} fullWidth>Save interaction</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No interactions found" emptyMessage="Log your first interaction." searchable searchPlaceholder="Search interactions..." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} select{height:var(--input-height-md)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
