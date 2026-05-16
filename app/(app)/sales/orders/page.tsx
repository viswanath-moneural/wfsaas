'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Badge, { STATUS_BADGE } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import TenantSetupNotice from '@/components/layout/TenantSetupNotice'
import { generateNextCode } from '@/lib/numberSeries'

interface CustomerOption {
  id: string
  customer_code: string
  customer_name: string
}

interface SalesOrderRow {
  id: string
  so_code: string
  order_date: string
  expected_date: string | null
  status: string | null
  name: string | null
  notes: string | null
  customers: CustomerOption | null
}

const EMPTY_FORM = {
  customer_id: '',
  order_date: new Date().toISOString().split('T')[0],
  expected_date: '',
  status: 'draft',
  notes: '',
}

export default function SalesOrdersPage() {
  const { tenant } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<SalesOrderRow[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { canCreate } = usePermissions('sales')

  useEffect(() => {
    if (!tenant?.id) {
      setLoading(false)
      return
    }

    fetchPageData(tenant.id)
  }, [tenant?.id])

  async function fetchPageData(tenantId: string) {
    setLoading(true)
    setError('')

    const supabase = getSupabaseClient()
    const [{ data: ordersData, error: ordersError }, { data: customersData, error: customersError }] = await Promise.all([
      supabase
        .from('sales_orders')
        .select(`
          id, so_code, order_date, expected_date, status, name, notes,
          customers(id, customer_code, customer_name)
        `)
        .eq('tenant_id', tenantId)
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('customers')
        .select('id, customer_code, customer_name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('customer_name', { ascending: true }),
    ])

    if (ordersError) setError(ordersError.message)
    else if (customersError) setError(customersError.message)

    setOrders((ordersData as unknown as SalesOrderRow[]) ?? [])
    setCustomers((customersData as CustomerOption[]) ?? [])
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id) return

    setSaving(true)
    setError('')

    const supabase = getSupabaseClient()
    let soCode = ''
    try {
      soCode = (await generateNextCode(tenant.id, 'sales_order')).code
    } catch (seriesError: any) {
      setSaving(false)
      setError(`${seriesError.message} Configure Number Series in Configuration.`)
      return
    }
    const { error: insertError } = await supabase.from('sales_orders').insert({
      tenant_id: tenant.id,
      so_code: soCode,
      customer_id: form.customer_id,
      order_date: form.order_date,
      expected_date: form.expected_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
      name: soCode,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setForm({
      ...EMPTY_FORM,
      order_date: new Date().toISOString().split('T')[0],
      customer_id: customers[0]?.id ?? '',
    })
    await fetchPageData(tenant.id)
  }

  useEffect(() => {
    if (!form.customer_id && customers[0]?.id) {
      setForm((prev) => ({ ...prev, customer_id: customers[0].id }))
    }
  }, [customers, form.customer_id])

  const columns: Column<SalesOrderRow>[] = useMemo(() => [
    { key: 'so_code', header: 'Order No.' },
    {
      key: 'customers',
      header: 'Customer',
      render: (_value, row) => row.customers?.customer_name ?? '-',
    },
    { key: 'order_date', header: 'Order Date' },
    { key: 'expected_date', header: 'Expected', render: (value) => value || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (value) => {
        const status = String(value ?? 'draft')
        return <Badge variant={STATUS_BADGE[status] ?? 'default'}>{status}</Badge>
      },
    },
    { key: 'notes', header: 'Notes', render: (value) => value || '-' },
  ], [])

  if (!tenant) {
    return <TenantSetupNotice title="Sales Orders" description="Select or create a factory before creating sales orders." />
  }

  return (
    <>
      <PageHeader
        title="Sales Orders"
        description={`Create and track customer orders for ${tenant.name}.`}
      />

      <section className="transaction-layout">
        <Card>
          <h2>Create Order</h2>
          <form onSubmit={handleSubmit}>
            <Input label="Order number" value="Auto-generated from Number Series" disabled />

            <label>
              <span>Customer</span>
              <select
                value={form.customer_id}
                onChange={(event) => setForm((prev) => ({ ...prev, customer_id: event.target.value }))}
                required
                disabled={!canCreate || customers.length === 0}
              >
                {customers.length === 0 ? (
                  <option value="">No customers available</option>
                ) : (
                  customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.customer_name} ({customer.customer_code})
                    </option>
                  ))
                )}
              </select>
            </label>

            <Input
              label="Order date"
              type="date"
              value={form.order_date}
              onChange={(event) => setForm((prev) => ({ ...prev, order_date: event.target.value }))}
              required
              disabled={!canCreate}
            />

            <Input
              label="Expected date"
              type="date"
              value={form.expected_date}
              onChange={(event) => setForm((prev) => ({ ...prev, expected_date: event.target.value }))}
              disabled={!canCreate}
            />

            <label>
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                disabled={!canCreate}
              >
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </label>

            <Input
              label="Notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Optional"
              disabled={!canCreate}
            />

            {error && <p className="form-error">{error}</p>}
            {customers.length === 0 && (
              <p className="helper-link">No customers yet. <Link href="/configuration/customers">Add customer</Link></p>
            )}
            <Button
              title={!canCreate ? 'You do not have permission to create records.' : undefined}
              type="submit"
              loading={saving}
              disabled={!canCreate || customers.length === 0}
              fullWidth
            >
              Create order
            </Button>
          </form>
        </Card>

        <DataTable
          columns={columns}
          data={orders}
          loading={loading}
          emptyTitle="No sales orders found"
          emptyMessage="Add customers in Configuration first, then create your first order."
          searchable
          searchPlaceholder="Search orders..."
          onRowClick={(row) => router.push(`/sales/orders/${row.id}`)}
        />
      </section>

      <style jsx>{`
        .transaction-layout {
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
        .helper-link {
          margin: 0;
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }
        .helper-link :global(a) {
          color: var(--color-primary-700);
        }

        @media (max-width: 920px) {
          .transaction-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}
