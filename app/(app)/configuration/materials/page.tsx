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
import { createMaterial } from '@/app/actions/platform'

interface MaterialRow {
  id: string
  material_code: string
  material_name: string
  unit: string | null
  reorder_level: number | null
  is_active: boolean
}

const EMPTY_FORM = {
  material_code: '',
  material_name: '',
  unit: 'kg',
  reorder_level: '',
}

export default function MaterialsPage() {
  const { tenant, permissions } = useAuth()
  const [rows, setRows] = useState<MaterialRow[]>([])
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
    fetchMaterials(tenant.id)
  }, [tenant?.id])

  async function fetchMaterials(tenantId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('materials')
      .select('id, material_code, material_name, unit, reorder_level, is_active')
      .eq('tenant_id', tenantId)
      .order('material_code', { ascending: true })

    if (fetchError) setError(fetchError.message)
    setRows((data as MaterialRow[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id) return

    setSaving(true)
    setError('')

    const result = await createMaterial({
      tenant_id: tenant.id,
      material_code: form.material_code.trim(),
      material_name: form.material_name.trim(),
      unit: form.unit.trim(),
      reorder_level: form.reorder_level ? Number(form.reorder_level) : null,
    })

    setSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setForm(EMPTY_FORM)
    await fetchMaterials(tenant.id)
  }

  const columns: Column<MaterialRow>[] = useMemo(() => [
    { key: 'material_code', header: 'Code' },
    { key: 'material_name', header: 'Material' },
    { key: 'unit', header: 'Unit', render: (value) => value || '-' },
    { key: 'reorder_level', header: 'Reorder', render: (value) => value ?? '-' },
    {
      key: 'is_active',
      header: 'Status',
      render: (value) => <Badge variant={value ? 'success' : 'slate'}>{value ? 'Active' : 'Inactive'}</Badge>,
    },
  ], [])

  if (!tenant) {
    return <TenantSetupNotice title="Materials" description="Select or create a factory before creating material masters." />
  }

  return (
    <>
      <PageHeader title="Materials" description={`Raw materials for ${tenant.name}.`} />

      <section className="master-layout">
        <Card>
          <h2>Add Material</h2>
          <form onSubmit={handleSubmit}>
            <Input
              label="Material code"
              value={form.material_code}
              onChange={(event) => setForm((prev) => ({ ...prev, material_code: event.target.value }))}
              placeholder="RM001"
              required
              disabled={!canEdit}
            />
            <Input
              label="Material name"
              value={form.material_name}
              onChange={(event) => setForm((prev) => ({ ...prev, material_name: event.target.value }))}
              placeholder="Paper roll"
              required
              disabled={!canEdit}
            />
            <Input
              label="Unit"
              value={form.unit}
              onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
              placeholder="kg"
              required
              disabled={!canEdit}
            />
            <Input
              label="Reorder level"
              type="number"
              min="0"
              value={form.reorder_level}
              onChange={(event) => setForm((prev) => ({ ...prev, reorder_level: event.target.value }))}
              disabled={!canEdit}
            />
            {error && <p className="form-error">{error}</p>}
            <Button type="submit" loading={saving} disabled={!canEdit} fullWidth>Add material</Button>
          </form>
        </Card>

        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          emptyTitle="No materials found"
          emptyMessage="Add raw materials before creating purchase orders or stock movements."
          searchable
          searchPlaceholder="Search materials..."
        />
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
