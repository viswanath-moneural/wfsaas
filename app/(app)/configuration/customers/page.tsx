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
import TenantSetupNotice from '@/components/layout/TenantSetupNotice'
import { createCustomer } from '@/app/actions/platform'

interface CustomerRow {
  id: string
  party_id: string | null
  customer_code: string
  customer_name: string
  company_name: string | null
  mobile: string | null
  gst_number: string | null
  city: string | null
  state: string | null
  is_active: boolean
  parties?: {
    party_name: string | null
    legal_name: string | null
    phone: string | null
    gst_number: string | null
    city: string | null
    state: string | null
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
  customer_code: '',
  customer_name: '',
  company_name: '',
  mobile: '',
  gst_number: '',
  city: '',
  state: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  contact_designation: '',
  contact_role_type: 'sales',
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

export default function CustomersPage() {
  const { tenant } = useAuth()
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { canCreate: canEdit } = usePermissions('configuration')

  useEffect(() => {
    if (!tenant?.id) {
      setLoading(false)
      return
    }
    fetchCustomers(tenant.id)
  }, [tenant?.id])

  async function fetchCustomers(tenantId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('customers')
      .select('id, party_id, customer_code, customer_name, company_name, mobile, gst_number, city, state, is_active, parties(party_name, legal_name, phone, gst_number, city, state), contact_roles(role_type, is_primary, contact_persons(name, phone, email, designation))')
      .eq('tenant_id', tenantId)
      .order('customer_code', { ascending: true })

    if (fetchError) setError(fetchError.message)
    setRows(normalizePartyModelRows((data ?? []) as any[]) as CustomerRow[])
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id) return

    setSaving(true)
    setError('')

    const result = await createCustomer({
      tenant_id: tenant.id,
      customer_code: form.customer_code.trim(),
      customer_name: form.customer_name.trim(),
      company_name: form.company_name.trim() || null,
      mobile: form.mobile.trim() || null,
      gst_number: form.gst_number.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_designation: form.contact_designation.trim() || null,
      contact_role_type: form.contact_role_type.trim() || 'sales',
    })

    setSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setForm(EMPTY_FORM)
    await fetchCustomers(tenant.id)
  }

  const columns: Column<CustomerRow>[] = useMemo(() => [
    { key: 'customer_code', header: 'Code' },
    { key: 'customer_name', header: 'Customer', render: (_value, row) => row.parties?.party_name || row.customer_name },
    { key: 'company_name', header: 'Legal name', render: (_value, row) => row.parties?.legal_name || row.company_name || '-' },
    { key: 'mobile', header: 'Phone', render: (_value, row) => row.parties?.phone || row.mobile || '-' },
    { key: 'gst_number', header: 'GSTIN', render: (_value, row) => row.parties?.gst_number || row.gst_number || '-' },
    { key: 'city', header: 'City', render: (_value, row) => row.parties?.city || row.city || '-' },
    { key: 'contact_roles', header: 'Primary contact', render: (_value, row) => {
      const primary = row.contact_roles?.find((role) => role.is_primary) ?? row.contact_roles?.[0]
      return primary?.contact_persons?.name || '-'
    } },
    {
      key: 'is_active',
      header: 'Status',
      render: (value) => <Badge variant={value ? 'success' : 'slate'}>{value ? 'Active' : 'Inactive'}</Badge>,
    },
  ], [])

  if (!tenant) {
    return <TenantSetupNotice title="Customers" description="Select or create a factory before creating customer masters." />
  }

  return (
    <>
      <PageHeader title="Customers" description={`Customers for ${tenant.name}.`} />

      <section className="master-layout">
        <Card>
          <h2>Add Customer</h2>
          <form onSubmit={handleSubmit}>
            <Input label="Customer code" value={form.customer_code} onChange={(event) => setForm((prev) => ({ ...prev, customer_code: event.target.value }))} placeholder="CUST001" required disabled={!canEdit} />
            <Input label="Customer name" value={form.customer_name} onChange={(event) => setForm((prev) => ({ ...prev, customer_name: event.target.value }))} placeholder="Retail Buyer" required disabled={!canEdit} />
            <Input label="Company name" value={form.company_name} onChange={(event) => setForm((prev) => ({ ...prev, company_name: event.target.value }))} disabled={!canEdit} />
            <Input label="Mobile" value={form.mobile} onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))} disabled={!canEdit} />
            <Input label="GSTIN" value={form.gst_number} onChange={(event) => setForm((prev) => ({ ...prev, gst_number: event.target.value }))} disabled={!canEdit} />
            <Input label="City" value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} disabled={!canEdit} />
            <Input label="State" value={form.state} onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))} disabled={!canEdit} />
            <h3>Primary Contact</h3>
            <Input label="Contact name" value={form.contact_name} onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))} disabled={!canEdit} />
            <Input label="Contact phone" value={form.contact_phone} onChange={(event) => setForm((prev) => ({ ...prev, contact_phone: event.target.value }))} disabled={!canEdit} />
            <Input label="Contact email" type="email" value={form.contact_email} onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))} disabled={!canEdit} />
            <Input label="Designation" value={form.contact_designation} onChange={(event) => setForm((prev) => ({ ...prev, contact_designation: event.target.value }))} disabled={!canEdit} />
            {error && <p className="form-error">{error}</p>}
            <Button title={!canEdit ? 'You do not have permission to edit configuration.' : undefined} type="submit" loading={saving} disabled={!canEdit} fullWidth>Add customer</Button>
          </form>
        </Card>

        <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No customers found" emptyMessage="Add customers before creating sales orders or invoices." searchable searchPlaceholder="Search customers..." />
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
