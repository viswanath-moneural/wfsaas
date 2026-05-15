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
import { getSupabaseClient } from '@/lib/supabase'

export default function LeadsPage() {
  const { tenant, permissions } = useAuth()
  const canCreate = permissions?.is_admin || permissions?.module_permissions.crm?.can_create
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ lead_code: '', name: '', company_name: '', phone: '', source: '', status: 'new', notes: '' })

  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase.from('leads').select('id, lead_code, name, company_name, phone, source, status, is_trial').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    if (fetchError) setError(fetchError.message)
    setRows(data ?? [])
    setLoading(false)
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id || !canCreate) return
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const { error: insertError } = await supabase.from('leads').insert({ tenant_id: tenant.id, lead_code: form.lead_code.trim(), name: form.name.trim(), company_name: form.company_name.trim() || null, phone: form.phone.trim() || null, source: form.source.trim() || null, status: form.status, notes: form.notes.trim() || null })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setForm({ lead_code: '', name: '', company_name: '', phone: '', source: '', status: 'new', notes: '' })
    await load(tenant.id)
  }
  if (!tenant) return <TenantSetupNotice title="Leads" description="Select or create a factory before creating leads." />
  const columns: Column<any>[] = useMemo(() => [
    { key: 'lead_code', header: 'Lead Code' }, { key: 'name', header: 'Name' }, { key: 'company_name', header: 'Company', render: (v) => v || '-' }, { key: 'phone', header: 'Phone', render: (v) => v || '-' }, { key: 'source', header: 'Source', render: (v) => v || '-' }, { key: 'status', header: 'Status', render: (v) => <Badge variant="info">{v || '-'}</Badge> },
  ], [])
  return <>
    <PageHeader title="Leads" description={`Lead pipeline for ${tenant.name}.`} />
    <section className="layout">
      <Card><h2>Add Lead</h2><form onSubmit={create}>
        <Input label="Lead code" value={form.lead_code} onChange={(e) => setForm((p) => ({ ...p, lead_code: e.target.value }))} required disabled={!canCreate} />
        <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required disabled={!canCreate} />
        <Input label="Company" value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} disabled={!canCreate} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} disabled={!canCreate} />
        <Input label="Source" value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} disabled={!canCreate} />
        <label><span>Status</span><select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} disabled={!canCreate}><option value="new">new</option><option value="qualified">qualified</option><option value="lost">lost</option></select></label>
        <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} disabled={!canCreate} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate} fullWidth>Add lead</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No leads found" emptyMessage="Add your first lead." searchable searchPlaceholder="Search leads..." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} select{height:var(--input-height-md)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
