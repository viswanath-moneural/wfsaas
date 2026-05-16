'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Card from '@/components/Card'
import DataTable from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import { isPurchaseEditable } from '@/lib/transactions'
import { useToast } from '@/lib/hooks/useToast'
import { handleSupabaseError } from '@/lib/handleSupabaseError'

export default function GrnDetailPage() {
  const { businessUnit } = useAuth()
  const { error: notifyError } = useToast()
  const params = useParams<{ id: string }>()
  const [grn, setGrn] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [form, setForm] = useState({ material_id: '', received_qty: '1', rejected_qty: '0', unit: 'kg', rate: '0', batch_no: '' })
  const [error, setError] = useState('')
  const { canEdit: canUpdate } = usePermissions('purchases')
  const canEditLines = canUpdate && isPurchaseEditable(grn?.purchase_orders?.status)
  useEffect(() => { if (!businessUnit?.id || !params.id) return; void load(businessUnit.id, params.id) }, [businessUnit?.id, params.id])
  async function load(businessUnitId: string, id: string) {
    const supabase = getSupabaseClient()
    const [{ data: header }, { data: lineItems }, { data: materialData }] = await Promise.all([
      supabase.from('goods_receipt_notes').select('id, grn_code, grn_date, vendors(vendor_name), purchase_orders(po_code, status)').eq('business_unit_id', businessUnitId).eq('id', id).single(),
      supabase.from('grn_items').select('id, received_qty, rejected_qty, unit, rate, batch_no, materials(material_code, material_name)').eq('grn_id', id).order('created_at', { ascending: true }),
      supabase.from('materials').select('id, material_code, material_name').eq('business_unit_id', businessUnitId).eq('is_active', true).order('material_code', { ascending: true }),
    ])
    setGrn(header); setItems(lineItems ?? []); setMaterials(materialData ?? [])
  }
  async function addItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!params.id) return
    if (!canEditLines) { setError('GRN lines can only be edited while linked PO is draft or approved.'); return }
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('grn_items').insert({ grn_id: params.id, material_id: form.material_id, received_qty: Number(form.received_qty), rejected_qty: Number(form.rejected_qty), unit: form.unit, rate: Number(form.rate), batch_no: form.batch_no || null }).select('id').single()
    if (handleSupabaseError(error, notifyError)) { setError(error?.message ?? 'Failed to add GRN item.'); return }
    if (businessUnit?.id) await load(businessUnit.id, params.id)
  }
  return <>
    <PageHeader title={grn?.grn_code ?? 'GRN'} description={`${grn?.vendors?.vendor_name ?? ''} / ${grn?.purchase_orders?.po_code ?? ''}`} />
    <section className="layout">
      <Card><h2>Add GRN Item</h2><form onSubmit={addItem}>
        <label><span>Material</span><select value={form.material_id} onChange={(e) => setForm((p) => ({ ...p, material_id: e.target.value }))} disabled={!canEditLines}>{materials.map((m) => <option key={m.id} value={m.id}>{m.material_code} - {m.material_name}</option>)}</select></label>
        <Input label="Received Qty" type="number" value={form.received_qty} onChange={(e) => setForm((p) => ({ ...p, received_qty: e.target.value }))} disabled={!canEditLines} />
        <Input label="Rejected Qty" type="number" value={form.rejected_qty} onChange={(e) => setForm((p) => ({ ...p, rejected_qty: e.target.value }))} disabled={!canEditLines} />
        <Input label="Unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} disabled={!canEditLines} />
        <Input label="Rate" type="number" value={form.rate} onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} disabled={!canEditLines} />
        <Input label="Batch No." value={form.batch_no} onChange={(e) => setForm((p) => ({ ...p, batch_no: e.target.value }))} disabled={!canEditLines} />
        {error && <p className="form-error">{error}</p>}
        <Button title={!canEditLines ? 'You do not have permission to edit this document.' : undefined} type="submit" disabled={!canEditLines} fullWidth>Add item</Button>
      </form></Card>
      <DataTable columns={[{ key: 'materials', header: 'Material', render: (_v, r) => `${r.materials?.material_code ?? ''} - ${r.materials?.material_name ?? ''}` }, { key: 'received_qty', header: 'Received' }, { key: 'rejected_qty', header: 'Rejected' }, { key: 'unit', header: 'Unit' }, { key: 'rate', header: 'Rate' }, { key: 'batch_no', header: 'Batch', render: (v) => v || '-' }]} data={items} />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}








