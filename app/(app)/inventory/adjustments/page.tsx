'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'

export default function AdjustmentsPage() {
  const { tenant, user, permissions } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [form, setForm] = useState({ adjustment_code: '', adjustment_date: new Date().toISOString().split('T')[0], item_type: 'material', material_id: '', product_id: '', warehouse_id: '', qty: '0', unit: 'kg', reason_code: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canCreate = permissions?.is_admin || permissions?.module_permissions.inventory?.can_create
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: adj }, { data: mat }, { data: prod }, { data: wh }] = await Promise.all([
      supabase.from('stock_adjustments').select('id, adjustment_code, adjustment_date, item_type, qty, unit, reason_code, warehouses(warehouse_code)').eq('tenant_id', tenantId).order('adjustment_date', { ascending: false }),
      supabase.from('materials').select('id, material_code, material_name').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('products').select('id, product_code, product_name').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('warehouses').select('id, warehouse_code, warehouse_name').eq('tenant_id', tenantId).eq('is_active', true),
    ])
    setRows(adj ?? []); setMaterials(mat ?? []); setProducts(prod ?? []); setWarehouses(wh ?? []); setLoading(false)
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!tenant?.id) return
    if (!canCreate) { setError('You do not have permission to post stock adjustments.'); return }
    setSaving(true)
    const supabase = getSupabaseClient()
    await supabase.from('stock_adjustments').insert({
      tenant_id: tenant.id, adjustment_code: form.adjustment_code, adjustment_date: form.adjustment_date, item_type: form.item_type, material_id: form.item_type === 'material' ? form.material_id : null,
      product_id: form.item_type === 'product' ? form.product_id : null, warehouse_id: form.warehouse_id || null, qty: Number(form.qty), unit: form.unit, reason_code: form.reason_code || null, notes: form.notes || null, approved_by: user?.id ?? null,
    })
    setSaving(false); await load(tenant.id)
  }
  const columns: Column<any>[] = useMemo(() => [
    { key: 'adjustment_code', header: 'Adj No.' }, { key: 'adjustment_date', header: 'Date' }, { key: 'item_type', header: 'Item Type' }, { key: 'qty', header: 'Qty', align: 'right' }, { key: 'unit', header: 'Unit' }, { key: 'reason_code', header: 'Reason', render: (v) => v || '-' }, { key: 'warehouses', header: 'Warehouse', render: (_v, r) => r.warehouses?.warehouse_code ?? '-' },
  ], [])
  return <>
    <PageHeader title="Stock Adjustments" description="Post manual stock corrections with reason and approver metadata." />
    <section className="layout">
      <Card><h2>Create adjustment</h2><form onSubmit={create}>
        <Input label="Adjustment no." value={form.adjustment_code} onChange={(e) => setForm((p) => ({ ...p, adjustment_code: e.target.value }))} required />
        <Input label="Date" type="date" value={form.adjustment_date} onChange={(e) => setForm((p) => ({ ...p, adjustment_date: e.target.value }))} />
        <label><span>Item type</span><select value={form.item_type} onChange={(e) => setForm((p) => ({ ...p, item_type: e.target.value }))}><option value="material">Material</option><option value="product">Product</option></select></label>
        {form.item_type === 'material' ? <label><span>Material</span><select value={form.material_id} onChange={(e) => setForm((p) => ({ ...p, material_id: e.target.value }))}>{materials.map((m) => <option key={m.id} value={m.id}>{m.material_code} - {m.material_name}</option>)}</select></label> : <label><span>Product</span><select value={form.product_id} onChange={(e) => setForm((p) => ({ ...p, product_id: e.target.value }))}>{products.map((m) => <option key={m.id} value={m.id}>{m.product_code} - {m.product_name}</option>)}</select></label>}
        <label><span>Warehouse</span><select value={form.warehouse_id} onChange={(e) => setForm((p) => ({ ...p, warehouse_id: e.target.value }))}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouse_code} - {w.warehouse_name}</option>)}</select></label>
        <Input label="Qty" type="number" value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} />
        <Input label="Unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
        <Input label="Reason code" value={form.reason_code} onChange={(e) => setForm((p) => ({ ...p, reason_code: e.target.value }))} />
        <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate} fullWidth>Save adjustment</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No adjustments" emptyMessage="Post adjustment entries with reason codes." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
