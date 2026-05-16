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
import { createBusinessUnit } from '@/app/actions/platform'

interface BusinessUnitRow {
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

export default function BusinessUnitsPage() {
  const { org, user, refreshAuth } = useAuth()
  const [rows, setRows] = useState<BusinessUnitRow[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const role = String(user?.role ?? '').toLowerCase()
  const { canCreate: canEdit } = usePermissions('configuration')

  useEffect(() => {
    if (!org?.id) return
    fetchBusinessUnits(org.id)
  }, [org?.id])

  async function fetchBusinessUnits(orgId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('business_units')
      .select('id, name, phone, address, is_active, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (fetchError) setError(fetchError.message)
    setRows((data as BusinessUnitRow[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const supabase = getSupabaseClient()
    let targetOrgId = org?.id ?? null
    if (!targetOrgId && role === 'superadmin') {
      const { data: fallbackOrg } = await supabase
        .from('organisations')
        .select('id')
        .eq('slug', 'wfsaas-platform')
        .maybeSingle()
      if (fallbackOrg?.id) {
        targetOrgId = fallbackOrg.id
      } else {
        const { data: firstOrg } = await supabase
          .from('organisations')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        targetOrgId = firstOrg?.id ?? null
      }
    }
    if (!targetOrgId) {
      setError('No organisation available. Create one from Configuration > Organisation.')
      return
    }

    setSaving(true)
    setError('')

    const result = await createBusinessUnit({
      org_id: targetOrgId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
    })

    setSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setForm(EMPTY_FORM)
    await fetchBusinessUnits(targetOrgId)
    await refreshAuth()
  }

  const columns: Column<BusinessUnitRow>[] = useMemo(() => [
    { key: 'name', header: 'BusinessUnit' },
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
        title="Business Units"
        description="Business units are operating units. Transactional data is isolated at this level."
      />

      <section className="master-layout">
        <Card>
          <h2>Add Business Unit</h2>
          <form onSubmit={handleSubmit}>
            <Input
              label="Business Unit name"
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
              placeholder="Business Unit address"
              disabled={!canEdit}
            />
            {error && <p className="form-error">{error}</p>}
            {!canEdit && <p className="form-hint">You do not have permission to create business units.</p>}
            {!org?.id && role !== 'superadmin' && <p className="form-hint">Organisation context missing for current user.</p>}
            <Button title={!canEdit ? 'You do not have permission to edit configuration.' : undefined} type="submit" loading={saving} disabled={!canEdit} fullWidth>
              Add business unit
            </Button>
          </form>
        </Card>

        <div>
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            emptyTitle="No business units found"
            emptyMessage="Add the first business unit to start entering business-unit-level transactions."
            searchable
            searchPlaceholder="Search business units..."
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













