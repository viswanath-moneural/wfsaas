'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import BusinessUnitSetupNotice from '@/components/layout/BusinessUnitSetupNotice'
import { createVendor } from '@/app/actions/platform'

interface VendorRow {
  id: string
  party_id: string | null
  vendor_code: string
  vendor_name: string
  phone_number: string | null
  gst_number: string | null
  notes: string | null
  is_active: boolean
  parties?: {
    party_name: string | null
    legal_name: string | null
    phone: string | null
    gst_number: string | null
  } | null
  contact_roles?: Array<{
    role_type: string | null
    is_primary: boolean | null
    contact_persons?: {
      name: string | null
      phone: string | null
      email: string | null
      designation: string | null
    } | null
  }>
}

const EMPTY_FORM = {
  vendor_code: '',
  vendor_name: '',
  phone_number: '',
  gst_number: '',
  notes: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  contact_designation: '',
  contact_role_type: 'procurement',
}

function normalizePartyModelRows<T extends { parties?: any; contact_roles?: any }>(rows: T[] | null) {
  return (rows ?? []).map((row) => ({
    ...row,
    parties: Array.isArray(row.parties) ? row.parties[0] ?? null : row.parties ?? null,
    contact_roles: (row.contact_roles ?? []).map((role: any) => ({
      ...role,
      contact_persons: Array.isArray(role.contact_persons)
        ? role.contact_persons[0] ?? null
        : role.contact_persons ?? null,
    })),
  }))
}

export default function VendorsPage() {
  const { businessUnit } = useAuth()
  const [rows, setRows] = useState<VendorRow[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { canCreate: canEdit } = usePermissions('configuration')

  useEffect(() => {
    if (!businessUnit?.id) {
      setLoading(false)
      return
    }
    fetchVendors(businessUnit.id)
  }, [businessUnit?.id])

  async function fetchVendors(businessUnitId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('vendors')
      .select('id, party_id, vendor_code, vendor_name, phone_number, gst_number, notes, is_active, parties(party_name, legal_name, phone, gst_number), contact_roles(role_type, is_primary, contact_persons(name, phone, email, designation))')
      .eq('business_unit_id', businessUnitId)
      .order('vendor_code', { ascending: true })

    if (fetchError) setError(fetchError.message)
    setRows(normalizePartyModelRows((data ?? []) as any[]) as VendorRow[])
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!businessUnit?.id) return

    setSaving(true)
    setError('')

    const result = await createVendor({
      business_unit_id: businessUnit.id,
      vendor_code: form.vendor_code.trim(),
      vendor_name: form.vendor_name.trim(),
      phone_number: form.phone_number.trim() || null,
      gst_number: form.gst_number.trim() || null,
      notes: form.notes.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_designation: form.contact_designation.trim() || null,
      contact_role_type: form.contact_role_type.trim() || 'procurement',
    })

    setSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setForm(EMPTY_FORM)
    await fetchVendors(businessUnit.id)
  }

  const columns: Column<VendorRow>[] = useMemo(() => [
    { key: 'vendor_code', header: 'Code' },
    { key: 'vendor_name', header: 'Vendor', render: (_value, row) => row.parties?.party_name || row.vendor_name },
    { key: 'phone_number', header: 'Phone', render: (_value, row) => row.parties?.phone || row.phone_number || '-' },
    { key: 'gst_number', header: 'GSTIN', render: (_value, row) => row.parties?.gst_number || row.gst_number || '-' },
    { key: 'contact_roles', header: 'Primary contact', render: (_value, row) => {
      const primary = row.contact_roles?.find((role) => role.is_primary) ?? row.contact_roles?.[0]
      return primary?.contact_persons?.name || '-'
    } },
    { key: 'notes', header: 'Notes', render: (value) => value || '-' },
    {
      key: 'is_active',
      header: 'Status',
      render: (value) => <Badge variant={value ? 'success' : 'slate'}>{value ? 'Active' : 'Inactive'}</Badge>,
    },
  ], [])

  if (!businessUnit) {
    return <BusinessUnitSetupNotice title="Vendors" description="Select or create a businessUnit before creating vendor masters." />
  }

  return (
    <>
      <PageHeader title="Vendors" description={`Vendors for ${businessUnit.name}.`} />

      <section className="master-layout">
        <Card>
          <h2>Add Vendor</h2>
          <form onSubmit={handleSubmit}>
            <Input label="Vendor code" value={form.vendor_code} onChange={(event) => setForm((prev) => ({ ...prev, vendor_code: event.target.value }))} placeholder="VEN001" required disabled={!canEdit} />
            <Input label="Vendor name" value={form.vendor_name} onChange={(event) => setForm((prev) => ({ ...prev, vendor_name: event.target.value }))} placeholder="Raw material supplier" required disabled={!canEdit} />
            <Input label="Phone" value={form.phone_number} onChange={(event) => setForm((prev) => ({ ...prev, phone_number: event.target.value }))} disabled={!canEdit} />
            <Input label="GSTIN" value={form.gst_number} onChange={(event) => setForm((prev) => ({ ...prev, gst_number: event.target.value }))} disabled={!canEdit} />
            <Input label="Notes" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} disabled={!canEdit} />
            <h3>Primary Contact</h3>
            <Input label="Contact name" value={form.contact_name} onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))} disabled={!canEdit} />
            <Input label="Contact phone" value={form.contact_phone} onChange={(event) => setForm((prev) => ({ ...prev, contact_phone: event.target.value }))} disabled={!canEdit} />
            <Input label="Contact email" type="email" value={form.contact_email} onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))} disabled={!canEdit} />
            <Input label="Designation" value={form.contact_designation} onChange={(event) => setForm((prev) => ({ ...prev, contact_designation: event.target.value }))} disabled={!canEdit} />
            {error && <p className="form-error">{error}</p>}
            <Button title={!canEdit ? 'You do not have permission to edit configuration.' : undefined} type="submit" loading={saving} disabled={!canEdit} fullWidth>Add vendor</Button>
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

        h3 {
          margin: var(--space-2) 0 0;
          font-size: var(--text-sm);
          color: var(--text-secondary);
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









