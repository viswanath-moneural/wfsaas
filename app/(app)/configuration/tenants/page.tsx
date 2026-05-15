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

interface TenantRow {
  id: string
  name: string
  phone: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

const EMPTY_FORM = {
  name: '',
  phone: '',
  address: '',
}

export default function TenantsPage() {
  const { org, user, refreshAuth, permissions } = useAuth()
  const [rows, setRows] = useState<TenantRow[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const role = String(user?.role ?? '').toLowerCase()
  const canEdit = Boolean(permissions?.is_admin || role === 'superadmin' || role === 'owner' || role === 'admin')

  useEffect(() => {
    if (!org?.id) return
    fetchTenants(org.id)
  }, [org?.id])

  async function fetchTenants(orgId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('tenants')
      .select('id, name, phone, address, is_active, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (fetchError) setError(fetchError.message)
    setRows((data as TenantRow[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!org?.id) {
      setError('No organisation mapped to this login. Set org_id in users table and relogin.')
      return
    }

    setSaving(true)
    setError('')

    const supabase = getSupabaseClient()
    const { error: insertError } = await supabase.from('tenants').insert({
      org_id: org.id,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      is_active: true,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setForm(EMPTY_FORM)
    await fetchTenants(org.id)
    await refreshAuth()
  }

  const columns: Column<TenantRow>[] = useMemo(() => [
    { key: 'name', header: 'Factory' },
    { key: 'phone', header: 'Phone', render: (value) => value || '-' },
    { key: 'address', header: 'Address', render: (value) => value || '-' },
    {
      key: 'is_active',
      header: 'Status',
      render: (value) => (
        <Badge variant={value ? 'success' : 'slate'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ], [])

  return (
    <>
      <PageHeader
        title="Factories"
        description="Factories are tenants. Transactional data is isolated at this level."
      />

      <section className="master-layout">
        <Card>
          <h2>Add Factory</h2>
          <form onSubmit={handleSubmit}>
            <Input
              label="Factory name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Acme - Hyderabad Plant"
              required
              disabled={!canEdit}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="+91..."
              disabled={!canEdit}
            />
            <Input
              label="Address"
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              placeholder="Factory address"
              disabled={!canEdit}
            />
            {error && <p className="form-error">{error}</p>}
            {!canEdit && <p className="form-hint">You do not have permission to create factories.</p>}
            {!org?.id && <p className="form-hint">Organisation context missing for current user.</p>}
            <Button type="submit" loading={saving} disabled={!canEdit} fullWidth>
              Add factory
            </Button>
          </form>
        </Card>

        <div>
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            emptyTitle="No factories found"
            emptyMessage="Add the first factory to start entering tenant-level transactions."
            searchable
            searchPlaceholder="Search factories..."
          />
        </div>
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
        .form-hint {
          margin: 0;
          color: var(--text-secondary);
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
