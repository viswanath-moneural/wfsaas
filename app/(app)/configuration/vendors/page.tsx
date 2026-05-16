'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import TenantSetupNotice from '@/components/layout/TenantSetupNotice'
import { createVendor } from '@/app/actions/platform'

interface VendorRow {
  id: string
  vendor_code: string
  vendor_name: string
  phone_number: string | null
  gst_number: string | null
  notes: string | null
  is_active: boolean
}

const EMPTY_FORM = {
  vendor_code: '',
  vendor_name: '',
  phone_number: '',
  gst_number: '',
  notes: '',
}

export default function VendorsPage() {
  const { tenant, permissions } = useAuth()
  const [rows, setRows] = useState<VendorRow[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canEdit = permissions?.is_admin || permissions?.module_permissions.configuration?.can_create

  useEffect(() => {
    if (!tenant?.id) {
      setLoading(false)
      return
    }
    fetchVendors(tenant.id)
  }, [tenant?.id])

  async function fetchVendors(tenantId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('vendors')
      .select('id, vendor_code, vendor_name, phone_number, gst_number, notes, is_active')
      .eq('tenant_id', tenantId)
      .order('vendor_code', { ascending: true })

    if (fetchError) setError(fetchError.message)
    setRows((data as VendorRow[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id) return

    setSaving(true)
    setError('')

    const result = await createVendor({
      tenant_id: tenant.id,
      vendor_code: form.vendor_code.trim(),
      vendor_name: form.vendor_name.trim(),
      phone_number: form.phone_number.trim() || null,
      gst_number: form.gst_number.trim() || null,
      notes: form.notes.trim() || null,
    })

    setSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setForm(EMPTY_FORM)
    await fetchVendors(tenant.id)
  }

  const columns: Column<VendorRow>[] = useMemo(() => [
    { key: 'vendor_code', header: 'Code' },
    { key: 'vendor_name', header: 'Vendor' },
    { key: 'phone_number', header: 'Phone', render: (value) => value || '-' },
    { key: 'gst_number', header: 'GSTIN', render: (value) => value || '-' },
    { key: 'notes', header: 'Notes', render: (value) => value || '-' },
    {
      key: 'is_active',
      header: 'Status',
      render: (value) => <Badge variant={value ? 'success' : 'slate'}>{value ? 'Active' : 'Inactive'}</Badge>,
    },
  ], [])

  if (!tenant) {
    return <TenantSetupNotice title="Vendors" description="Select or create a factory before creating vendor masters." />
  }

  return (
    <>
      <PageHeader title="Vendors" description={`Vendors for ${tenant.name}.`} />

      <section className="master-layout">
        <Card>
          <h2>Add Vendor</h2>
          <form onSubmit={handleSubmit}>
            <Input label="Vendor code" value={form.vendor_code} onChange={(event) => setForm((prev) => ({ ...prev, vendor_code: event.target.value }))} placeholder="VEN001" required disabled={!canEdit} />
            <Input label="Vendor name" value={form.vendor_name} onChange={(event) => setForm((prev) => ({ ...prev, vendor_name: event.target.value }))} placeholder="Raw material supplier" required disabled={!canEdit} />
            <Input label="Phone" value={form.phone_number} onChange={(event) => setForm((prev) => ({ ...prev, phone_number: event.target.value }))} disabled={!canEdit} />
            <Input label="GSTIN" value={form.gst_number} onChange={(event) => setForm((prev) => ({ ...prev, gst_number: event.target.value }))} disabled={!canEdit} />
            <Input label="Notes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} disabled={!canEdit} />
            {error && <p className="form-error">{error}</p>}
            <Button type="submit" loading={saving} disabled={!canEdit} fullWidth>Add vendor</Button>
          </form>
        </Card>

        <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No vendors found" emptyMessage="Add vendors before creating purchase orders or GRNs." searchable searchPlaceholder="Search vendors..." />
      </section>

      <style jsx>{`
        .master-layout {
          display: grid;
          grid-template-columns: 360px minmax(0, 1fr);
          gap: var(--space-6);
          align-items: start;
        }

        h2 {
          margin: 0 0 var(--space-4);
          font-size: var(--text-lg);
        }

        form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .form-error {
          margin: 0;
          color: var(--text-danger);
          font-size: var(--text-sm);
        }

        @media (max-width: 920px) {
          .master-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}
