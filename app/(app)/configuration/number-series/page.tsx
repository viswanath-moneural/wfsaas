'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import TenantSetupNotice from '@/components/layout/TenantSetupNotice'

const ENTITY_OPTIONS = ['sales_order', 'dispatch_order', 'invoice', 'customer_payment', 'vendor_payment', 'purchase_order', 'grn']

export default function NumberSeriesPage() {
  const { tenant, permissions } = useAuth()
  const canEdit = permissions?.is_admin || permissions?.module_permissions.configuration?.can_create
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ entity_type: 'sales_order', prefix: '', suffix: '', separator: '-', num_digits: '4', start_from: '1', include_fin_year: true, include_month: false })

  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase.from('number_series_config').select('id, entity_type, prefix, suffix, separator, num_digits, start_from, current_value, include_fin_year, include_month, is_active').eq('tenant_id', tenantId).order('entity_type', { ascending: true })
    if (fetchError) setError(fetchError.message)
    setRows(data ?? [])
    setLoading(false)
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tenant?.id || !canEdit) return
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const payload = {
      tenant_id: tenant.id,
      entity_type: form.entity_type,
      prefix: form.prefix || null,
      suffix: form.suffix || null,
      separator: form.separator || '-',
      num_digits: Number(form.num_digits),
      start_from: Number(form.start_from),
      include_fin_year: form.include_fin_year,
      include_month: form.include_month,
      is_active: true,
    }
    const existing = rows.find((row) => row.entity_type === form.entity_type)
    const { error: saveError } = existing
      ? await supabase.from('number_series_config').update(payload).eq('id', existing.id)
      : await supabase.from('number_series_config').insert(payload)
    setSaving(false)
    if (saveError) { setError(saveError.message); return }
    await load(tenant.id)
  }

  const columns: Column<any>[] = useMemo(() => [
    { key: 'entity_type', header: 'Entity' },
    { key: 'prefix', header: 'Prefix', render: (v) => v || '-' },
    { key: 'suffix', header: 'Suffix', render: (v) => v || '-' },
    { key: 'num_digits', header: 'Digits', align: 'right' },
    { key: 'current_value', header: 'Current', align: 'right', render: (v) => v ?? '-' },
    { key: 'include_fin_year', header: 'FY', render: (v) => <Badge variant={v ? 'primary' : 'slate'}>{v ? 'On' : 'Off'}</Badge> },
    { key: 'is_active', header: 'Status', render: (v) => <Badge variant={v ? 'success' : 'slate'}>{v ? 'Active' : 'Inactive'}</Badge> },
  ], [])

  if (!tenant) return <TenantSetupNotice title="Number Series" description="Configure document codes after selecting a factory." />

  return (
    <>
      <PageHeader title="Number Series" description={`Configure document code generation for ${tenant.name}.`} />
      <section className="layout">
        <Card>
          <h2>Configure Series</h2>
          <form onSubmit={save}>
            <label><span>Entity</span><select value={form.entity_type} onChange={(e) => setForm((p) => ({ ...p, entity_type: e.target.value }))} disabled={!canEdit}>{ENTITY_OPTIONS.map((entity) => <option key={entity} value={entity}>{entity}</option>)}</select></label>
            <Input label="Prefix" value={form.prefix} onChange={(e) => setForm((p) => ({ ...p, prefix: e.target.value }))} disabled={!canEdit} />
            <Input label="Suffix" value={form.suffix} onChange={(e) => setForm((p) => ({ ...p, suffix: e.target.value }))} disabled={!canEdit} />
            <Input label="Separator" value={form.separator} onChange={(e) => setForm((p) => ({ ...p, separator: e.target.value }))} disabled={!canEdit} />
            <Input label="Digits" type="number" min="1" value={form.num_digits} onChange={(e) => setForm((p) => ({ ...p, num_digits: e.target.value }))} disabled={!canEdit} />
            <Input label="Start From" type="number" min="1" value={form.start_from} onChange={(e) => setForm((p) => ({ ...p, start_from: e.target.value }))} disabled={!canEdit} />
            <label className="check"><input type="checkbox" checked={form.include_fin_year} onChange={(e) => setForm((p) => ({ ...p, include_fin_year: e.target.checked }))} disabled={!canEdit} /><span>Include Financial Year</span></label>
            <label className="check"><input type="checkbox" checked={form.include_month} onChange={(e) => setForm((p) => ({ ...p, include_month: e.target.checked }))} disabled={!canEdit} /><span>Include Month</span></label>
            {error && <p className="form-error">{error}</p>}
            <Button type="submit" loading={saving} disabled={!canEdit} fullWidth>Save series</Button>
          </form>
        </Card>
        <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No series configured" emptyMessage="Add one series per document entity." />
      </section>
      <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} h2{margin:0 0 var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} select{height:var(--input-height-md)} .check{display:flex;flex-direction:row;align-items:center;gap:var(--space-2)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
    </>
  )
}
