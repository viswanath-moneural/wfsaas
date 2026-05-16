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

export default function AdjustmentsPage() {
  const { tenant, user } = useAuth()
  const { error: notifyError } = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [currentBalance, setCurrentBalance] = useState<string>('')
  const [confirmedBalance, setConfirmedBalance] = useState<string>('')
  const [form, setForm] = useState({ adjustment_code: '', adjustment_date: new Date().toISOString().split('T')[0], item_type: 'material', material_id: '', product_id: '', warehouse_id: '', location_id: '', qty: '0', unit: 'kg', reason_code: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { canCreate } = usePermissions('inventory')
  const selectedItemId = form.item_type === 'material' ? form.material_id : form.product_id
  const locationOptions = locations.filter((location) => location.warehouse_id === form.warehouse_id)
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  useEffect(() => {
    if (!tenant?.id || !form.warehouse_id || selectedItemId.length === 0) {
      setCurrentBalance('')
      return
    }
    void fetchWarehouseBalance(tenant.id, form.item_type, selectedItemId, form.warehouse_id).then(setCurrentBalance)
  }, [tenant?.id, form.item_type, form.material_id, form.product_id, form.warehouse_id])

  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: adj }, { data: mat }, { data: prod }, { data: wh }] = await Promise.all([
      supabase.from('stock_adjustments').select('id, adjustment_code, adjustment_date, item_type, qty, unit, reason_code, warehouses(warehouse_code), warehouse_locations(location_code)').eq('tenant_id', tenantId).order('adjustment_date', { ascending: false }),
      supabase.from('materials').select('id, material_code, material_name').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('products').select('id, product_code, product_name').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('warehouses').select('id, warehouse_code, warehouse_name').eq('tenant_id', tenantId).eq('is_active', true),
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
    setRows(adj ?? []); setMaterials(mat ?? []); setProducts(prod ?? []); setWarehouses(warehouseRows); setLocations(locationRows); setLoading(false)
  }

  function signedMovementQty(row: any) {
    const movementType = String(row.movement_type ?? '').toLowerCase()
    const qty = Number(row.qty ?? 0)
    return movementType.includes('out') || movementType.includes('issue') || movementType.includes('dispatch') ? -qty : qty
  }

  async function fetchWarehouseBalance(tenantId: string, itemType: string, itemId: string, warehouseId: string) {
    const supabase = getSupabaseClient()
    if (itemType === 'material') {
      const [{ data: movements }, { data: adjustments }] = await Promise.all([
        supabase.from('stock_movements').select('movement_type, qty').eq('tenant_id', tenantId).eq('warehouse_id', warehouseId).eq('material_id', itemId),
        supabase.from('stock_adjustments').select('qty').eq('tenant_id', tenantId).eq('warehouse_id', warehouseId).eq('material_id', itemId),
      ])
      const movementBalance = (movements ?? []).reduce((sum, row) => sum + signedMovementQty(row), 0)
      const adjustmentBalance = (adjustments ?? []).reduce((sum, row) => sum + Number(row.qty ?? 0), 0)
      return `${movementBalance + adjustmentBalance} ${form.unit}`
    }

    const [{ data: movements }, { data: adjustments }] = await Promise.all([
      supabase.from('finished_goods_movements').select('movement_type, qty').eq('tenant_id', tenantId).eq('warehouse_id', warehouseId).eq('product_id', itemId),
      supabase.from('stock_adjustments').select('qty').eq('tenant_id', tenantId).eq('warehouse_id', warehouseId).eq('product_id', itemId),
    ])
    const movementBalance = (movements ?? []).reduce((sum, row) => sum + signedMovementQty(row), 0)
    const adjustmentBalance = (adjustments ?? []).reduce((sum, row) => sum + Number(row.qty ?? 0), 0)
    return `${movementBalance + adjustmentBalance} units`
  }

  async function fetchConfirmedBalance(tenantId: string, itemType: string, itemId: string) {
    const supabase = getSupabaseClient()
    if (itemType === 'material') {
      const { data } = await supabase.from('stock_levels').select('current_stock, default_unit').eq('tenant_id', tenantId).eq('material_id', itemId).maybeSingle()
      return data ? `${Number(data.current_stock ?? 0)} ${data.default_unit ?? form.unit}` : 'No stock balance row found'
    }

    const { data } = await supabase.from('finished_goods_stock').select('current_stock').eq('tenant_id', tenantId).eq('product_id', itemId).maybeSingle()
    return data ? `${Number(data.current_stock ?? 0)} units` : 'No finished goods balance row found'
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!tenant?.id) return
    if (!canCreate) { setError('You do not have permission to post stock adjustments.'); return }
    if (!selectedItemId) { setError('Select an item before saving adjustment.'); return }
    if (!form.warehouse_id) { setError('Select a warehouse before saving adjustment.'); return }
    if (locationOptions.length > 0 && !form.location_id) { setError('Select a warehouse location before saving adjustment.'); return }
    if (!currentBalance) { setError('Current stock balance is still loading. Please wait before saving adjustment.'); return }
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('stock_adjustments').insert({
      tenant_id: tenant.id, adjustment_code: form.adjustment_code, adjustment_date: form.adjustment_date, item_type: form.item_type, material_id: form.item_type === 'material' ? form.material_id : null,
      product_id: form.item_type === 'product' ? form.product_id : null, warehouse_id: form.warehouse_id, location_id: form.location_id || null, qty: Number(form.qty), unit: form.unit, reason_code: form.reason_code || null, notes: form.notes || null, approved_by: user?.id ?? null,
    }).select('id').single()
    if (handleSupabaseError(error, notifyError)) { setSaving(false); setError(error?.message ?? 'Failed to save stock adjustment.'); return }
    const balance = await fetchConfirmedBalance(tenant.id, form.item_type, selectedItemId)
    setConfirmedBalance(`Saved. Stock balance view now reports: ${balance}`)
    await fetchWarehouseBalance(tenant.id, form.item_type, selectedItemId, form.warehouse_id).then(setCurrentBalance)
    setSaving(false); await load(tenant.id)
  }
  const columns: Column<any>[] = useMemo(() => [
    { key: 'adjustment_code', header: 'Adj No.' }, { key: 'adjustment_date', header: 'Date' }, { key: 'item_type', header: 'Item Type' }, { key: 'qty', header: 'Qty', align: 'right' }, { key: 'unit', header: 'Unit' }, { key: 'reason_code', header: 'Reason', render: (v) => v || '-' }, { key: 'warehouses', header: 'Warehouse', render: (_v, r) => r.warehouses?.warehouse_code ?? '-' }, { key: 'warehouse_locations', header: 'Location', render: (_v, r) => r.warehouse_locations?.location_code ?? '-' },
  ], [])
  return <>
    <PageHeader title="Stock Adjustments" description="Post manual stock corrections with reason and approver metadata." />
    <section className="layout">
      <Card><h2>Create adjustment</h2><form onSubmit={create}>
        <Input label="Adjustment no." value={form.adjustment_code} onChange={(e) => setForm((p) => ({ ...p, adjustment_code: e.target.value }))} required />
        <Input label="Date" type="date" value={form.adjustment_date} onChange={(e) => setForm((p) => ({ ...p, adjustment_date: e.target.value }))} />
        <label><span>Item type</span><select value={form.item_type} onChange={(e) => setForm((p) => ({ ...p, item_type: e.target.value, material_id: '', product_id: '' }))}><option value="material">Material</option><option value="product">Product</option></select></label>
        {form.item_type === 'material' ? <label><span>Material</span><select value={form.material_id} onChange={(e) => setForm((p) => ({ ...p, material_id: e.target.value }))} required><option value="">Select material</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.material_code} - {m.material_name}</option>)}</select></label> : <label><span>Product</span><select value={form.product_id} onChange={(e) => setForm((p) => ({ ...p, product_id: e.target.value }))} required><option value="">Select product</option>{products.map((m) => <option key={m.id} value={m.id}>{m.product_code} - {m.product_name}</option>)}</select></label>}
        <label><span>Warehouse</span><select value={form.warehouse_id} onChange={(e) => setForm((p) => ({ ...p, warehouse_id: e.target.value, location_id: '' }))} required><option value="">Select warehouse</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouse_code} - {w.warehouse_name}</option>)}</select></label>
        {locationOptions.length > 0 && <label><span>Location</span><select value={form.location_id} onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))} required><option value="">Select location</option>{locationOptions.map((location) => <option key={location.id} value={location.id}>{location.location_code} - {location.location_name}</option>)}</select></label>}
        {currentBalance && <p className="balance">Current warehouse balance: <strong>{currentBalance}</strong></p>}
        <Input label="Qty" type="number" value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} />
        <Input label="Unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
        <Input label="Reason code" value={form.reason_code} onChange={(e) => setForm((p) => ({ ...p, reason_code: e.target.value }))} />
        <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        {error && <p className="form-error">{error}</p>}
        {confirmedBalance && <p className="form-success">{confirmedBalance}</p>}
        <Button title={!canCreate ? 'You do not have permission to create records.' : undefined} type="submit" loading={saving} disabled={!canCreate} fullWidth>Save adjustment</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No adjustments" emptyMessage="Post adjustment entries with reason codes." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .balance{margin:0;color:var(--text-secondary);font-size:var(--text-sm)} .form-error{margin:0;color:var(--text-danger)} .form-success{margin:0;color:var(--text-success);font-size:var(--text-sm)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
