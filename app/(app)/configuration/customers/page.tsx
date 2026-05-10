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

interface CustomerRow {
  id: string
  customer_code: string
  customer_name: string
  company_name: string | null
  mobile: string | null
  gst_number: string | null
  city: string | null
  state: string | null
  is_active: boolean
}

const EMPTY_FORM = {
  customer_code: '',
  customer_name: '',
  company_name: '',
  mobile: '',
  gst_number: '',
  city: '',
  state: '',
}

export default function CustomersPage() {
  const { tenant, permissions } = useAuth()
  const [rows, setRows] = useState<CustomerRow[]>([])
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
    fetchCustomers(tenant.id)
  }, [tenant?.id])

  async function fetchCustomers(tenantId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('customers')
      .select('id, customer_code, customer_name, company_name, mobile, gst_number, city, state, is_active')
      .eq('tenant_id', tenantId)
      .order('customer_code', { ascending: true })

    if (fetchError) setError(fetchError.message)
    setRows((data as CustomerRow[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id) return

    setSaving(true)
    setError('')

    const supabase = getSupabaseClient()
    const { error: insertError } = await supabase.from('customers').insert({
      tenant_id: tenant.id,
      customer_code: form.customer_code.trim(),
      customer_name: form.customer_name.trim(),
      company_name: form.company_name.trim() || null,
      mobile: form.mobile.trim() || null,
      gst_number: form.gst_number.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      is_active: true,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setForm(EMPTY_FORM)
    await fetchCustomers(tenant.id)
  }

  const columns: Column<CustomerRow>[] = useMemo(() => [
    { key: 'customer_code', header: 'Code' },
    { key: 'customer_name', header: 'Customer' },
    { key: 'company_name', header: 'Company', render: (value) => value || '-' },
    { key: 'mobile', header: 'Mobile', render: (value) => value || '-' },
    { key: 'gst_number', header: 'GSTIN', render: (value) => value || '-' },
    { key: 'city', header: 'City', render: (value) => value || '-' },
    {
      key: 'is_active',
      header: 'Status',
      render: (value) => <Badge variant={value ? 'success' : 'slate'}>{value ? 'Active' : 'Inactive'}</Badge>,
    },
  ], [])

  if (!tenant) {
    return <PageHeader title="Customers" description="Select or create a factory before creating customer masters." />
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
            {error && <p className="form-error">{error}</p>}
            <Button type="submit" loading={saving} disabled={!canEdit} fullWidth>Add customer</Button>
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
