'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import { useToast } from '@/lib/hooks/useToast'
import { handleSupabaseError } from '@/lib/handleSupabaseError'

export default function MovementsPage() {
  const { tenant } = useAuth()
  const { error: notifyError } = useToast()
  const [rmRows, setRmRows] = useState<any[]>([])
  const [fgRows, setFgRows] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [confirmedBalance, setConfirmedBalance] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ item_type: 'material', item_id: '', warehouse_id: '', location_id: '', movement_type: 'in', qty: '0', unit: 'kg', movement_date: new Date().toISOString().split('T')[0], ref_table: '', ref_id: '' })
  const { canCreate } = usePermissions('inventory')
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: rm }, { data: fg }, { data: mat }, { data: prod }, { data: wh }] = await Promise.all([
      supabase.from('stock_movements').select('id, movement_date, movement_type, qty, unit, ref_table, materials(material_code, material_name), warehouses(warehouse_code), warehouse_locations(location_code)').eq('tenant_id', tenantId).order('movement_date', { ascending: false }).limit(100),
      supabase.from('finished_goods_movements').select('id, movement_date, movement_type, qty, ref_table, products(product_code, product_name), warehouses(warehouse_code), warehouse_locations(location_code)').eq('tenant_id', tenantId).order('movement_date', { ascending: false }).limit(100),
      supabase.from('materials').select('id, material_code, material_name, unit').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('products').select('id, product_code, product_name').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('warehouses').select('id, warehouse_code, warehouse_name').eq('tenant_id', tenantId).eq('is_active', true).order('warehouse_code', { ascending: true }),
    ])
    const warehouseRows = wh ?? []
    let locationRows: any[] = []
    if (warehouseRows.length > 0) {
      const { data: loc } = await supabase
        .from('warehouse_locations')
        .select('id, warehouse_id, location_code, location_name')
        .in('warehouse_id', warehouseRows.map((warehouse: any) => warehouse.id))
        .eq('is_active', true)
        .order('location_code', { ascending: true })
      locationRows = loc ?? []
    }
    setRmRows(rm ?? []); setFgRows(fg ?? []); setMaterials(mat ?? []); setProducts(prod ?? []); setWarehouses(warehouseRows); setLocations(locationRows); setLoading(false)
  }

  async function fetchConfirmedBalance(tenantId: string, itemType: string, itemId: string) {
    const supabase = getSupabaseClient()
    if (itemType === 'material') {
      const { data } = await supabase
        .from('stock_levels')
        .select('current_stock, default_unit')
        .eq('tenant_id', tenantId)
        .eq('material_id', itemId)
        .maybeSingle()
      return data ? `${Number(data.current_stock ?? 0)} ${data.default_unit ?? form.unit}` : 'No stock balance row found'
    }

    const { data } = await supabase
      .from('finished_goods_stock')
      .select('current_stock')
      .eq('tenant_id', tenantId)
      .eq('product_id', itemId)
      .maybeSingle()
    return data ? `${Number(data.current_stock ?? 0)} units` : 'No finished goods balance row found'
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!tenant?.id) return
    if (!canCreate) { setError('You do not have permission to create stock movements.'); return }
    if (!form.item_id) { setError('Select an item before saving movement.'); return }
    if (!form.warehouse_id) { setError('Select a warehouse before saving movement.'); return }
    if (locationOptions.length > 0 && !form.location_id) { setError('Select a warehouse location before saving movement.'); return }
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    if (form.item_type === 'material') {
      const { data, error } = await supabase.from('stock_movements').insert({ tenant_id: tenant.id, material_id: form.item_id, warehouse_id: form.warehouse_id, location_id: form.location_id || null, movement_date: form.movement_date, movement_type: form.movement_type, qty: Number(form.qty), unit: form.unit, ref_table: form.ref_table || null, ref_id: form.ref_id || null }).select('id').single()
      if (handleSupabaseError(error, notifyError)) { setSaving(false); setError(error?.message ?? 'Failed to save stock movement.'); return }
    } else {
      const { data, error } = await supabase.from('finished_goods_movements').insert({ tenant_id: tenant.id, product_id: form.item_id, warehouse_id: form.warehouse_id, location_id: form.location_id || null, movement_date: form.movement_date, movement_type: form.movement_type, qty: Number(form.qty), ref_table: form.ref_table || null, ref_id: form.ref_id || null }).select('id').single()
      if (handleSupabaseError(error, notifyError)) { setSaving(false); setError(error?.message ?? 'Failed to save finished goods movement.'); return }
    }
    const balance = await fetchConfirmedBalance(tenant.id, form.item_type, form.item_id)
    setConfirmedBalance(`Saved. Stock balance view now reports: ${balance}`)
    setSaving(false); await load(tenant.id)
  }
  const rmColumns: Column<any>[] = useMemo(() => [{ key: 'movement_date', header: 'Date' }, { key: 'materials', header: 'Material', render: (_v, r) => `${r.materials?.material_code ?? ''} - ${r.materials?.material_name ?? ''}` }, { key: 'warehouses', header: 'Warehouse', render: (_v, r) => r.warehouses?.warehouse_code ?? '-' }, { key: 'warehouse_locations', header: 'Location', render: (_v, r) => r.warehouse_locations?.location_code ?? '-' }, { key: 'movement_type', header: 'Type' }, { key: 'qty', header: 'Qty', align: 'right' }, { key: 'unit', header: 'Unit' }, { key: 'ref_table', header: 'Ref', render: (v) => v || '-' }], [])
  const fgColumns: Column<any>[] = useMemo(() => [{ key: 'movement_date', header: 'Date' }, { key: 'products', header: 'Product', render: (_v, r) => `${r.products?.product_code ?? ''} - ${r.products?.product_name ?? ''}` }, { key: 'warehouses', header: 'Warehouse', render: (_v, r) => r.warehouses?.warehouse_code ?? '-' }, { key: 'warehouse_locations', header: 'Location', render: (_v, r) => r.warehouse_locations?.location_code ?? '-' }, { key: 'movement_type', header: 'Type' }, { key: 'qty', header: 'Qty', align: 'right' }, { key: 'ref_table', header: 'Ref', render: (v) => v || '-' }], [])
  const itemOptions = form.item_type === 'material' ? materials : products
  const locationOptions = locations.filter((location) => location.warehouse_id === form.warehouse_id)
  return <>
    <PageHeader title="Stock Movements" description="Post and review movement entries with source references." />
    <section className="layout">
      <Card><h2>Add movement</h2><form onSubmit={create}>
        <label><span>Item type</span><select value={form.item_type} onChange={(e) => setForm((p) => ({ ...p, item_type: e.target.value, item_id: '' }))}><option value="material">Raw Material</option><option value="product">Finished Good</option></select></label>
        <label><span>Item</span><select value={form.item_id} onChange={(e) => setForm((p) => ({ ...p, item_id: e.target.value }))} required><option value="">Select item</option>{itemOptions.map((item) => <option key={item.id} value={item.id}>{item.material_code ?? item.product_code} - {item.material_name ?? item.product_name}</option>)}</select></label>
        <label><span>Warehouse</span><select value={form.warehouse_id} onChange={(e) => setForm((p) => ({ ...p, warehouse_id: e.target.value, location_id: '' }))} required><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.warehouse_code} - {warehouse.warehouse_name}</option>)}</select></label>
        {locationOptions.length > 0 && <label><span>Location</span><select value={form.location_id} onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))} required><option value="">Select location</option>{locationOptions.map((location) => <option key={location.id} value={location.id}>{location.location_code} - {location.location_name}</option>)}</select></label>}
        <Input label="Date" type="date" value={form.movement_date} onChange={(e) => setForm((p) => ({ ...p, movement_date: e.target.value }))} />
        <Input label="Type" value={form.movement_type} onChange={(e) => setForm((p) => ({ ...p, movement_type: e.target.value }))} />
        <Input label="Quantity" type="number" value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} />
        {form.item_type === 'material' && <Input label="Unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />}
        <Input label="Ref Table" value={form.ref_table} onChange={(e) => setForm((p) => ({ ...p, ref_table: e.target.value }))} />
        <Input label="Ref Id" value={form.ref_id} onChange={(e) => setForm((p) => ({ ...p, ref_id: e.target.value }))} />
        {error && <p className="form-error">{error}</p>}
        {confirmedBalance && <p className="form-success">{confirmedBalance}</p>}
        <Button title={!canCreate ? 'You do not have permission to create records.' : undefined} type="submit" loading={saving} disabled={!canCreate} fullWidth>Save movement</Button>
      </form></Card>
      <div><DataTable columns={rmColumns} data={rmRows} loading={loading} emptyTitle="No material movements" emptyMessage="Post stock entries to see movement history." /><div style={{ height: '16px' }} /><DataTable columns={fgColumns} data={fgRows} loading={loading} emptyTitle="No FG movements" emptyMessage="Production/dispatch movements show here." /></div>
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .form-error{margin:0;color:var(--text-danger)} .form-success{margin:0;color:var(--text-success);font-size:var(--text-sm)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
