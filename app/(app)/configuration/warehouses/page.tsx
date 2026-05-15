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

interface WarehouseRow {
  id: string
  warehouse_code: string
  warehouse_name: string
  city: string | null
  state: string | null
  is_default: boolean
  is_active: boolean
}

const EMPTY_FORM = {
  warehouse_code: '',
  warehouse_name: '',
  address: '',
  city: '',
  state: '',
  is_default: false,
}

export default function WarehousesPage() {
  const { tenant, permissions } = useAuth()
  const [rows, setRows] = useState<WarehouseRow[]>([])
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
    fetchWarehouses(tenant.id)
  }, [tenant?.id])

  async function fetchWarehouses(tenantId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('warehouses')
      .select('id, warehouse_code, warehouse_name, city, state, is_default, is_active')
      .eq('tenant_id', tenantId)
      .order('warehouse_code', { ascending: true })

    if (fetchError) setError(fetchError.message)
    setRows((data as WarehouseRow[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id) return

    setSaving(true)
    setError('')

    const supabase = getSupabaseClient()
    const { error: insertError } = await supabase.from('warehouses').insert({
      tenant_id: tenant.id,
      warehouse_code: form.warehouse_code.trim(),
      warehouse_name: form.warehouse_name.trim(),
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      is_default: form.is_default,
      is_active: true,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setForm(EMPTY_FORM)
    await fetchWarehouses(tenant.id)
  }

  const columns: Column<WarehouseRow>[] = useMemo(() => [
    { key: 'warehouse_code', header: 'Code' },
    { key: 'warehouse_name', header: 'Warehouse' },
    { key: 'city', header: 'City', render: (value) => value || '-' },
    { key: 'state', header: 'State', render: (value) => value || '-' },
    {
      key: 'is_default',
      header: 'Default',
      render: (value) => <Badge variant={value ? 'primary' : 'slate'}>{value ? 'Default' : 'No'}</Badge>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (value) => <Badge variant={value ? 'success' : 'slate'}>{value ? 'Active' : 'Inactive'}</Badge>,
    },
  ], [])

  if (!tenant) {
    return <TenantSetupNotice title="Warehouses" description="Select or create a factory before creating warehouse masters." />
  }

  return (
    <>
      <PageHeader title="Warehouses" description={`Stock locations for ${tenant.name}.`} />

      <section className="master-layout">
        <Card>
          <h2>Add Warehouse</h2>
          <form onSubmit={handleSubmit}>
            <Input label="Warehouse code" value={form.warehouse_code} onChange={(event) => setForm((prev) => ({ ...prev, warehouse_code: event.target.value }))} placeholder="WH001" required disabled={!canEdit} />
            <Input label="Warehouse name" value={form.warehouse_name} onChange={(event) => setForm((prev) => ({ ...prev, warehouse_name: event.target.value }))} placeholder="Main Store" required disabled={!canEdit} />
            <Input label="Address" value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} disabled={!canEdit} />
            <Input label="City" value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} disabled={!canEdit} />
            <Input label="State" value={form.state} onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))} disabled={!canEdit} />
            <label className="check-row">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(event) => setForm((prev) => ({ ...prev, is_default: event.target.checked }))}
                disabled={!canEdit}
              />
              <span>Set as default warehouse</span>
            </label>
            {error && <p className="form-error">{error}</p>}
            <Button type="submit" loading={saving} disabled={!canEdit} fullWidth>Add warehouse</Button>
          </form>
        </Card>

        <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No warehouses found" emptyMessage="Add warehouses before using stock movements or adjustments." searchable searchPlaceholder="Search warehouses..." />
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

        .check-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text-primary);
          font-size: var(--text-sm);
        }

        .check-row input {
          width: 16px;
          height: 16px;
          accent-color: var(--color-primary-600);
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
