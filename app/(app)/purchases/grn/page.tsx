'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge, { STATUS_BADGE } from '@/components/ui/Badge'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { generateNextCode, seedDefaultNumberSeries } from '@/lib/numberSeries'
import { useToast } from '@/lib/hooks/useToast'
import { handleSupabaseError } from '@/lib/handleSupabaseError'

export default function GrnPage() {
  const { tenant, permissions } = useAuth()
  const { error: notifyError } = useToast()
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [poOptions, setPoOptions] = useState<any[]>([])
  const [form, setForm] = useState({ po_id: '', grn_date: new Date().toISOString().split('T')[0], vehicle_no: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canCreate = permissions?.is_admin || permissions?.module_permissions.purchases?.can_create
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  useEffect(() => {
    if (!form.po_id && poOptions[0]?.id) {
      setForm((prev) => ({ ...prev, po_id: poOptions[0].id }))
    }
  }, [poOptions, form.po_id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    try {
      await seedDefaultNumberSeries(tenantId, ['GRN'])
    } catch (seriesError: any) {
      setError(seriesError.message)
    }
    const [{ data: grn }, { data: po }] = await Promise.all([
      supabase.from('goods_receipt_notes').select('id, grn_code, grn_date, quality_status, purchase_orders(po_code), vendors(vendor_name)').eq('tenant_id', tenantId).order('grn_date', { ascending: false }),
      supabase.from('purchase_orders').select('id, po_code, vendor_id, vendors(vendor_name)').eq('tenant_id', tenantId).order('po_date', { ascending: false }),
    ])
    setRows(grn ?? []); setPoOptions(po ?? []); setLoading(false)
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!tenant?.id || !form.po_id) return
    if (!canCreate) { setError('You do not have permission to create GRNs.'); return }
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const selected = poOptions.find((item) => item.id === form.po_id)
    let grnCode = ''
    try {
      await seedDefaultNumberSeries(tenant.id, ['GRN'])
      grnCode = (await generateNextCode(tenant.id, 'GRN')).code
    } catch (seriesError: any) {
      setSaving(false)
      setError(seriesError.message)
      return
    }
    const { data, error } = await supabase.from('goods_receipt_notes').insert({ tenant_id: tenant.id, grn_code: grnCode, po_id: form.po_id, vendor_id: selected?.vendor_id, grn_date: form.grn_date, vehicle_no: form.vehicle_no || null, quality_status: 'pending', name: grnCode }).select('id').single()
    if (handleSupabaseError(error, notifyError)) { setSaving(false); setError(error?.message ?? 'Failed to create GRN.'); return }
    const { data: updatedOrder, error: updateError } = await supabase.from('purchase_orders').update({ status: 'received' }).eq('tenant_id', tenant.id).eq('id', form.po_id).select('id').single()
    if (handleSupabaseError(updateError, notifyError)) { setSaving(false); setError(updateError?.message ?? 'Failed to update purchase order status.'); return }
    setSaving(false); await load(tenant.id); if (data?.id) router.push(`/purchases/grn/${data.id}`)
  }
  const columns: Column<any>[] = useMemo(() => [
    { key: 'grn_code', header: 'GRN No.' }, { key: 'purchase_orders', header: 'PO', render: (_v, r) => r.purchase_orders?.po_code ?? '-' }, { key: 'vendors', header: 'Vendor', render: (_v, r) => r.vendors?.vendor_name ?? '-' }, { key: 'grn_date', header: 'Date' }, { key: 'quality_status', header: 'Quality', render: (v) => <Badge variant={STATUS_BADGE[String(v ?? 'pending')] ?? 'default'}>{String(v ?? 'pending')}</Badge> },
  ], [])
  return <>
    <PageHeader title="Goods Receipt Notes" description="Record received and rejected quantities by PO." />
    <section className="layout">
      <Card><h2>Create GRN</h2><form onSubmit={create}>
        <Input label="GRN number" value="Auto-generated from Number Series" disabled />
        <label><span>PO</span><select value={form.po_id} onChange={(e) => setForm((p) => ({ ...p, po_id: e.target.value }))}>{poOptions.map((po) => <option key={po.id} value={po.id}>{po.po_code} - {po.vendors?.vendor_name}</option>)}</select></label>
        <Input label="GRN date" type="date" value={form.grn_date} onChange={(e) => setForm((p) => ({ ...p, grn_date: e.target.value }))} required />
        <Input label="Vehicle no." value={form.vehicle_no} onChange={(e) => setForm((p) => ({ ...p, vehicle_no: e.target.value }))} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate || poOptions.length === 0} fullWidth>Create GRN</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} onRowClick={(row) => router.push(`/purchases/grn/${row.id}`)} emptyTitle="No GRNs yet" emptyMessage="Create GRN against PO." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
