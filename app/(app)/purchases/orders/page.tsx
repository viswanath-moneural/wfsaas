'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Badge, { STATUS_BADGE } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import { generateNextCode, seedDefaultNumberSeries } from '@/lib/numberSeries'
import { useToast } from '@/lib/hooks/useToast'
import { handleSupabaseError } from '@/lib/handleSupabaseError'

interface Vendor { id: string; vendor_code: string; vendor_name: string }
interface PoRow { id: string; po_code: string; po_date: string; expected_date: string | null; status: string | null; vendors: Vendor | null }

export default function PurchaseOrdersPage() {
  const { businessUnit } = useAuth()
  const { error: notifyError } = useToast()
  const router = useRouter()
  const [rows, setRows] = useState<PoRow[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [form, setForm] = useState({ vendor_id: '', po_date: new Date().toISOString().split('T')[0], expected_date: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { canCreate } = usePermissions('purchases')
  useEffect(() => { if (!businessUnit?.id) { setLoading(false); return } ; void fetchData(businessUnit.id) }, [businessUnit?.id])
  useEffect(() => {
    if (!form.vendor_id && vendors[0]?.id) {
      setForm((prev) => ({ ...prev, vendor_id: vendors[0].id }))
    }
  }, [vendors, form.vendor_id])
  async function fetchData(businessUnitId: string) {
    const supabase = getSupabaseClient()
    try {
      await seedDefaultNumberSeries(businessUnitId, ['PO'])
    } catch (seriesError: any) {
      setError(seriesError.message)
    }
    const [{ data: po }, { data: v }] = await Promise.all([
      supabase.from('purchase_orders').select('id, po_code, po_date, expected_date, status, vendors(id, vendor_code, vendor_name)').eq('business_unit_id', businessUnitId).order('po_date', { ascending: false }),
      supabase.from('vendors').select('id, vendor_code, vendor_name').eq('business_unit_id', businessUnitId).eq('is_active', true).order('vendor_name', { ascending: true }),
    ])
    setRows((po as unknown as PoRow[]) ?? [])
    setVendors((v as Vendor[]) ?? [])
    setLoading(false)
  }
  async function createPo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!businessUnit?.id) return
    if (!canCreate) { setError('You do not have permission to create purchase orders.'); return }
    if (!form.vendor_id) { setError('Select a vendor before creating a purchase order.'); return }
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    let poCode = ''
    try {
      await seedDefaultNumberSeries(businessUnit.id, ['PO'])
      poCode = (await generateNextCode(businessUnit.id, 'PO')).code
    } catch (seriesError: any) {
      setSaving(false)
      setError(seriesError.message)
      return
    }
    const { data, error } = await supabase.from('purchase_orders').insert({ business_unit_id: businessUnit.id, po_code: poCode, vendor_id: form.vendor_id, po_date: form.po_date, expected_date: form.expected_date || null, status: 'draft', notes: form.notes || null, name: poCode }).select('id').single()
    setSaving(false)
    if (handleSupabaseError(error, notifyError)) { setError(error?.message ?? 'Failed to create purchase order.'); return }
    await fetchData(businessUnit.id)
    if (data?.id) router.push(`/purchases/orders/${data.id}`)
  }
  const columns: Column<PoRow>[] = useMemo(() => [
    { key: 'po_code', header: 'PO No.' }, { key: 'vendors', header: 'Vendor', render: (_v, r) => r.vendors?.vendor_name ?? '-' }, { key: 'po_date', header: 'Date' }, { key: 'expected_date', header: 'Expected', render: (v) => v || '-' },
    { key: 'status', header: 'Status', render: (v) => <Badge variant={STATUS_BADGE[String(v ?? 'draft')] ?? 'default'}>{String(v ?? 'draft')}</Badge> },
  ], [])
  return <>
    <PageHeader title="Purchase Orders" description="Create and track purchase orders." />
    <section className="layout">
      <Card><h2>Create PO</h2><form onSubmit={createPo}>
        <Input label="PO number" value="Auto-generated from Number Series" disabled />
        <label><span>Vendor</span><select value={form.vendor_id} onChange={(e) => setForm((p) => ({ ...p, vendor_id: e.target.value }))}>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendor_name} ({vendor.vendor_code})</option>)}</select></label>
        <Input label="PO date" type="date" value={form.po_date} onChange={(e) => setForm((p) => ({ ...p, po_date: e.target.value }))} required />
        <Input label="Expected date" type="date" value={form.expected_date} onChange={(e) => setForm((p) => ({ ...p, expected_date: e.target.value }))} />
        <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        {error && <p className="form-error">{error}</p>}
        <Button title={!canCreate ? 'You do not have permission to create records.' : undefined} type="submit" loading={saving} disabled={!canCreate || vendors.length === 0} fullWidth>Create PO</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} onRowClick={(row) => router.push(`/purchases/orders/${row.id}`)} emptyTitle="No purchase orders found" emptyMessage="Create your first PO." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}








