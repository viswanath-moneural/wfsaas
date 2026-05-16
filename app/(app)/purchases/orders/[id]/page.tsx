'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Card from '@/components/Card'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import Badge, { STATUS_BADGE } from '@/components/ui/Badge'
import { canTransitionPurchaseStatus, isPurchaseEditable } from '@/lib/transactions'
import { useToast } from '@/lib/hooks/useToast'
import { handleSupabaseError } from '@/lib/handleSupabaseError'

export default function PurchaseOrderDetailPage() {
  const { tenant, permissions } = useAuth()
  const { error: notifyError } = useToast()
  const params = useParams<{ id: string }>()
  const [po, setPo] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [form, setForm] = useState({ material_id: '', ordered_qty: '1', unit: 'kg', rate: '0' })
  const [status, setStatus] = useState('draft')
  const [error, setError] = useState('')
  const canUpdate = permissions?.is_admin || permissions?.module_permissions.purchases?.can_update
  const canEditLines = canUpdate && isPurchaseEditable(po?.status)
  useEffect(() => { if (!tenant?.id || !params.id) return; void load(tenant.id, params.id) }, [tenant?.id, params.id])
  async function load(tenantId: string, id: string) {
    const supabase = getSupabaseClient()
    const [{ data: poData }, { data: itemData }, { data: materialData }] = await Promise.all([
      supabase.from('purchase_orders').select('id, po_code, po_date, status, vendors(vendor_name)').eq('tenant_id', tenantId).eq('id', id).single(),
      supabase.from('purchase_order_items').select('id, ordered_qty, unit, rate, materials(material_code, material_name)').eq('po_id', id).order('sort_order', { ascending: true }),
      supabase.from('materials').select('id, material_code, material_name, unit').eq('tenant_id', tenantId).eq('is_active', true).order('material_code', { ascending: true }),
    ])
    setPo(poData); setStatus(poData?.status ?? 'draft'); setItems(itemData ?? []); setMaterials(materialData ?? [])
  }
  async function addItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!params.id) return
    if (!canEditLines) { setError('PO lines can only be edited in draft or approved status.'); return }
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('purchase_order_items').insert({ po_id: params.id, material_id: form.material_id, ordered_qty: Number(form.ordered_qty), unit: form.unit, rate: Number(form.rate), sort_order: items.length + 1 }).select('id').single()
    if (handleSupabaseError(error, notifyError)) { setError(error?.message ?? 'Failed to add purchase order item.'); return }
    if (tenant?.id) await load(tenant.id, params.id)
  }
  async function saveStatus() {
    if (!tenant?.id || !params.id || !po) return
    if (!canUpdate) return
    if (!canTransitionPurchaseStatus(po.status, status)) { setError(`Invalid status transition from ${po.status ?? 'draft'} to ${status}.`); return }
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('purchase_orders').update({ status }).eq('tenant_id', tenant.id).eq('id', params.id).select('id').single()
    if (handleSupabaseError(error, notifyError)) { setError(error?.message ?? 'Failed to update purchase order status.'); return }
    await load(tenant.id, params.id)
  }
  return <>
    <PageHeader title={po?.po_code ?? 'Purchase Order'} description={po?.vendors?.vendor_name ?? ''} />
    <Card><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}><Badge variant={STATUS_BADGE[String(po?.status ?? 'draft')] ?? 'default'}>{po?.status ?? 'draft'}</Badge><div style={{ display: 'flex', gap: '8px' }}><select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canUpdate}>{['draft', 'approved', 'received', 'closed', 'cancelled'].map((option) => <option key={option} value={option} disabled={!canTransitionPurchaseStatus(po?.status, option)}>{option}</option>)}</select><Button onClick={saveStatus} disabled={!canUpdate}>Save status</Button></div></div></Card>
    <div style={{ height: '16px' }} />
    <section className="layout">
      <Card><h2>Add item</h2><form onSubmit={addItem}>
        <label><span>Material</span><select value={form.material_id} onChange={(e) => setForm((p) => ({ ...p, material_id: e.target.value }))} disabled={!canEditLines}>{materials.map((m) => <option key={m.id} value={m.id}>{m.material_code} - {m.material_name}</option>)}</select></label>
        <Input label="Qty" type="number" value={form.ordered_qty} onChange={(e) => setForm((p) => ({ ...p, ordered_qty: e.target.value }))} disabled={!canEditLines} />
        <Input label="Unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} disabled={!canEditLines} />
        <Input label="Rate" type="number" value={form.rate} onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} disabled={!canEditLines} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" disabled={!canEditLines} fullWidth>Add item</Button>
      </form></Card>
      <DataTable columns={[{ key: 'materials', header: 'Material', render: (_v, r) => `${r.materials?.material_code ?? ''} - ${r.materials?.material_name ?? ''}` }, { key: 'ordered_qty', header: 'Qty' }, { key: 'unit', header: 'Unit' }, { key: 'rate', header: 'Rate' }]} data={items} />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .form-error{margin:0;color:var(--text-danger)} select{height:var(--input-height-md)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
