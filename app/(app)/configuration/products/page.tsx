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

interface ProductRow {
  id: string
  product_code: string
  product_name: string
  category: string | null
  sku: string | null
  reorder_level: number | null
  is_active: boolean
}

const EMPTY_FORM = {
  product_code: '',
  product_name: '',
  category: 'Cups',
  sku: '',
  reorder_level: '',
}

export default function ProductsPage() {
  const { tenant, permissions } = useAuth()
  const [rows, setRows] = useState<ProductRow[]>([])
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
    fetchProducts(tenant.id)
  }, [tenant?.id])

  async function fetchProducts(tenantId: string) {
    setLoading(true)
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('products')
      .select('id, product_code, product_name, category, sku, reorder_level, is_active')
      .eq('tenant_id', tenantId)
      .order('product_code', { ascending: true })

    if (fetchError) setError(fetchError.message)
    setRows((data as ProductRow[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id) return

    setSaving(true)
    setError('')

    const supabase = getSupabaseClient()
    const { error: insertError } = await supabase.from('products').insert({
      tenant_id: tenant.id,
      product_code: form.product_code.trim(),
      product_name: form.product_name.trim(),
      category: form.category,
      sku: form.sku.trim() || null,
      reorder_level: form.reorder_level ? Number(form.reorder_level) : null,
      is_active: true,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setForm(EMPTY_FORM)
    await fetchProducts(tenant.id)
  }

  const columns: Column<ProductRow>[] = useMemo(() => [
    { key: 'product_code', header: 'Code' },
    { key: 'product_name', header: 'Product' },
    { key: 'category', header: 'Category', render: (value) => value || '-' },
    { key: 'sku', header: 'SKU', render: (value) => value || '-' },
    { key: 'reorder_level', header: 'Reorder', render: (value) => value ?? '-' },
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

  if (!tenant) {
    return (
      <PageHeader
        title="Products"
        description="Select or create a factory before creating tenant-level product masters."
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Products"
        description={`Finished goods for ${tenant.name}. These feed sales, inventory, and production.`}
      />

      <section className="master-layout">
        <Card>
          <h2>Add Product</h2>
          <form onSubmit={handleSubmit}>
            <Input
              label="Product code"
              value={form.product_code}
              onChange={(event) => setForm((prev) => ({ ...prev, product_code: event.target.value }))}
              placeholder="P001"
              required
              disabled={!canEdit}
            />
            <Input
              label="Product name"
              value={form.product_name}
              onChange={(event) => setForm((prev) => ({ ...prev, product_name: event.target.value }))}
              placeholder="250 ml Paper Cup"
              required
              disabled={!canEdit}
            />
            <label>
              <span>Category</span>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                disabled={!canEdit}
              >
                <option value="Cups">Cups</option>
                <option value="Lids">Lids</option>
              </select>
            </label>
            <Input
              label="SKU"
              value={form.sku}
              onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
              placeholder="Optional SKU"
              disabled={!canEdit}
            />
            <Input
              label="Reorder level"
              type="number"
              min="0"
              value={form.reorder_level}
              onChange={(event) => setForm((prev) => ({ ...prev, reorder_level: event.target.value }))}
              placeholder="0"
              disabled={!canEdit}
            />
            {error && <p className="form-error">{error}</p>}
            <Button type="submit" loading={saving} disabled={!canEdit} fullWidth>
              Add product
            </Button>
          </form>
        </Card>

        <div>
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            emptyTitle="No products found"
            emptyMessage="Add products before creating sales orders, invoices, or production runs."
            searchable
            searchPlaceholder="Search products..."
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

        label {
          display: flex;
          flex-direction: column;
          gap: var(--space-1-5);
        }

        label span {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          color: var(--text-primary);
        }

        select {
          width: 100%;
          height: var(--input-height-md);
          padding: 0 var(--input-px);
          border: 1px solid var(--border-default);
          border-radius: var(--input-radius);
          background: var(--surface-input);
          color: var(--text-primary);
          font-size: var(--input-font-size);
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
