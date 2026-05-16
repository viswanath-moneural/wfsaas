'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import { useToast } from '@/lib/hooks/useToast'
import { handleSupabaseError } from '@/lib/handleSupabaseError'

export default function MovementsPage() {
  const { tenant, permissions } = useAuth()
  const { error: notifyError } = useToast()
  const [rmRows, setRmRows] = useState<any[]>([])
  const [fgRows, setFgRows] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ item_type: 'material', item_id: '', movement_type: 'in', qty: '0', unit: 'kg', movement_date: new Date().toISOString().split('T')[0], ref_table: '', ref_id: '' })
  const canCreate = permissions?.is_admin || permissions?.module_permissions.inventory?.can_create
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: rm }, { data: fg }, { data: mat }, { data: prod }] = await Promise.all([
      supabase.from('stock_movements').select('id, movement_date, movement_type, qty, unit, ref_table, materials(material_code, material_name)').eq('tenant_id', tenantId).order('movement_date', { ascending: false }).limit(100),
      supabase.from('finished_goods_movements').select('id, movement_date, movement_type, qty, ref_table, products(product_code, product_name)').eq('tenant_id', tenantId).order('movement_date', { ascending: false }).limit(100),
      supabase.from('materials').select('id, material_code, material_name, unit').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('products').select('id, product_code, product_name').eq('tenant_id', tenantId).eq('is_active', true),
    ])
    setRmRows(rm ?? []); setFgRows(fg ?? []); setMaterials(mat ?? []); setProducts(prod ?? []); setLoading(false)
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!tenant?.id) return
    if (!canCreate) { setError('You do not have permission to create stock movements.'); return }
    if (!form.item_id) { setError('Select an item before saving movement.'); return }
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    if (form.item_type === 'material') {
      const { data, error } = await supabase.from('stock_movements').insert({ tenant_id: tenant.id, material_id: form.item_id, movement_date: form.movement_date, movement_type: form.movement_type, qty: Number(form.qty), unit: form.unit, ref_table: form.ref_table || null, ref_id: form.ref_id || null }).select('id').single()
      if (handleSupabaseError(error, notifyError)) { setSaving(false); setError(error?.message ?? 'Failed to save stock movement.'); return }
    } else {
      const { data, error } = await supabase.from('finished_goods_movements').insert({ tenant_id: tenant.id, product_id: form.item_id, movement_date: form.movement_date, movement_type: form.movement_type, qty: Number(form.qty), ref_table: form.ref_table || null, ref_id: form.ref_id || null }).select('id').single()
      if (handleSupabaseError(error, notifyError)) { setSaving(false); setError(error?.message ?? 'Failed to save finished goods movement.'); return }
    }
    setSaving(false); await load(tenant.id)
  }
  const rmColumns: Column<any>[] = useMemo(() => [{ key: 'movement_date', header: 'Date' }, { key: 'materials', header: 'Material', render: (_v, r) => `${r.materials?.material_code ?? ''} - ${r.materials?.material_name ?? ''}` }, { key: 'movement_type', header: 'Type' }, { key: 'qty', header: 'Qty', align: 'right' }, { key: 'unit', header: 'Unit' }, { key: 'ref_table', header: 'Ref', render: (v) => v || '-' }], [])
  const fgColumns: Column<any>[] = useMemo(() => [{ key: 'movement_date', header: 'Date' }, { key: 'products', header: 'Product', render: (_v, r) => `${r.products?.product_code ?? ''} - ${r.products?.product_name ?? ''}` }, { key: 'movement_type', header: 'Type' }, { key: 'qty', header: 'Qty', align: 'right' }, { key: 'ref_table', header: 'Ref', render: (v) => v || '-' }], [])
  const itemOptions = form.item_type === 'material' ? materials : products
  return <>
    <PageHeader title="Stock Movements" description="Post and review movement entries with source references." />
    <section className="layout">
      <Card><h2>Add movement</h2><form onSubmit={create}>
        <label><span>Item type</span><select value={form.item_type} onChange={(e) => setForm((p) => ({ ...p, item_type: e.target.value, item_id: '' }))}><option value="material">Raw Material</option><option value="product">Finished Good</option></select></label>
        <label><span>Item</span><select value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))}>{itemOptions.map((item) => <option key={item.id} value={item.id}>{item.material_code ?? item.product_code} - {item.material_name ?? item.product_name}</option>)}</select></label>
        <Input label="Date" type="date" value={form.movement_date} onChange={(e) => setForm((p) => ({ ...p, movement_date: e.target.value }))} />
        <Input label="Type" value={form.movement_type} onChange={(e) => setForm((p) => ({ ...p, movement_type: e.target.value }))} />
        <Input label="Quantity" type="number" value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} />
        {form.item_type === 'material' && <Input label="Unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />}
        <Input label="Ref Table" value={form.ref_table} onChange={(e) => setForm((p) => ({ ...p, ref_table: e.target.value }))} />
        <Input label="Ref Id" value={form.ref_id} onChange={(e) => setForm((p) => ({ ...p, ref_id: e.target.value }))} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate} fullWidth>Save movement</Button>
      </form></Card>
      <div><DataTable columns={rmColumns} data={rmRows} loading={loading} emptyTitle="No material movements" emptyMessage="Post stock entries to see movement history." /><div style={{ height: '16px' }} /><DataTable columns={fgColumns} data={fgRows} loading={loading} emptyTitle="No FG movements" emptyMessage="Production/dispatch movements show here." /></div>
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
