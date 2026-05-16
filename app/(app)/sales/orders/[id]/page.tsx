'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Badge, { STATUS_BADGE } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import { canTransitionSalesStatus, isSalesEditable } from '@/lib/transactions'

const PACKAGING_TYPES = ['Packet', 'Box', 'Carton', 'Piece']
const ORDER_STATUSES = ['draft', 'confirmed', 'dispatched', 'invoiced', 'paid', 'cancelled']

interface SalesOrder {
  id: string
  tenant_id: string
  so_code: string
  order_date: string
  expected_date: string | null
  status: string | null
  notes: string | null
  customers: {
    customer_code: string
    customer_name: string
    company_name: string | null
  } | null
}

interface ProductOption {
  id: string
  product_code: string
  product_name: string
}

interface SalesOrderItem {
  id: string
  product_id: string
  packaging_type: string
  ordered_qty: number
  unit_price: number
  discount_pct: number | null
  sort_order: number | null
  products: ProductOption | null
}

const EMPTY_ITEM_FORM = {
  product_id: '',
  packaging_type: 'Packet',
  ordered_qty: '1',
  unit_price: '0',
  discount_pct: '0',
}

export default function SalesOrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { tenant } = useAuth()
  const orderId = params.id

  const [order, setOrder] = useState<SalesOrder | null>(null)
  const [items, setItems] = useState<SalesOrderItem[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM)
  const [status, setStatus] = useState('draft')
  const [loading, setLoading] = useState(true)
  const [savingItem, setSavingItem] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [error, setError] = useState('')

  const { canEdit: canUpdate } = usePermissions('sales')
  const canEditLines = canUpdate && isSalesEditable(order?.status)

  useEffect(() => {
    if (!tenant?.id || !orderId) {
      setLoading(false)
      return
    }

    fetchDetail(tenant.id, orderId)
  }, [tenant?.id, orderId])

  useEffect(() => {
    if (!itemForm.product_id && products[0]?.id) {
      setItemForm((prev) => ({ ...prev, product_id: products[0].id }))
    }
  }, [itemForm.product_id, products])

  async function fetchDetail(tenantId: string, id: string) {
    setLoading(true)
    setError('')

    const supabase = getSupabaseClient()
    const [{ data: orderData, error: orderError }, { data: itemsData, error: itemsError }, { data: productsData, error: productsError }] = await Promise.all([
      supabase
        .from('sales_orders')
        .select(`
          id, tenant_id, so_code, order_date, expected_date, status, notes,
          customers(customer_code, customer_name, company_name)
        `)
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .single(),
      supabase
        .from('sales_order_items')
        .select(`
          id, product_id, packaging_type, ordered_qty, unit_price, discount_pct, sort_order,
          products(id, product_code, product_name)
        `)
        .eq('so_id', id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('products')
        .select('id, product_code, product_name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('product_code', { ascending: true }),
    ])

    if (orderError) setError(orderError.message)
    else if (itemsError) setError(itemsError.message)
    else if (productsError) setError(productsError.message)

    const nextOrder = (orderData as unknown as SalesOrder) ?? null
    setOrder(nextOrder)
    setStatus(nextOrder?.status ?? 'draft')
    setItems((itemsData as unknown as SalesOrderItem[]) ?? [])
    setProducts((productsData as ProductOption[]) ?? [])
    setLoading(false)
  }

  async function handleAddItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id || !orderId) return
    if (!canEditLines) {
      setError('Line items can only be edited in draft or confirmed status.')
      return
    }

    setSavingItem(true)
    setError('')

    const supabase = getSupabaseClient()
    const { error: insertError } = await supabase.from('sales_order_items').insert({
      so_id: orderId,
      product_id: itemForm.product_id,
      packaging_type: itemForm.packaging_type,
      ordered_qty: Number(itemForm.ordered_qty),
      unit_price: Number(itemForm.unit_price),
      discount_pct: Number(itemForm.discount_pct || 0),
      sort_order: items.length + 1,
    })

    setSavingItem(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setItemForm({
      ...EMPTY_ITEM_FORM,
      product_id: products[0]?.id ?? '',
    })
    await fetchDetail(tenant.id, orderId)
  }

  async function handleStatusSave() {
    if (!tenant?.id || !orderId) return
    if (!order) return
    if (!canTransitionSalesStatus(order.status, status)) {
      setError(`Invalid status transition from ${order.status ?? 'draft'} to ${status}.`)
      return
    }

    setSavingStatus(true)
    setError('')

    const supabase = getSupabaseClient()
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ status })
      .eq('tenant_id', tenant.id)
      .eq('id', orderId)

    setSavingStatus(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await fetchDetail(tenant.id, orderId)
  }

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + getLineAmount(item), 0)
  }, [items])

  const itemColumns: Column<SalesOrderItem>[] = useMemo(() => [
    {
      key: 'products',
      header: 'Product',
      render: (_value, row) => row.products
        ? `${row.products.product_code} - ${row.products.product_name}`
        : '-',
    },
    { key: 'packaging_type', header: 'Packaging' },
    { key: 'ordered_qty', header: 'Qty', align: 'right' },
    {
      key: 'unit_price',
      header: 'Unit Price',
      align: 'right',
      render: (value) => formatMoney(Number(value ?? 0)),
    },
    {
      key: 'discount_pct',
      header: 'Discount',
      align: 'right',
      render: (value) => `${Number(value ?? 0)}%`,
    },
    {
      key: 'id',
      header: 'Line Amount',
      align: 'right',
      render: (_value, row) => formatMoney(getLineAmount(row)),
    },
  ], [])

  if (loading) {
    return <PageHeader title="Sales Order" description="Loading order..." />
  }

  if (!tenant) {
    return <PageHeader title="Sales Order" description="Select a factory before viewing sales orders." />
  }

  if (!order) {
    return (
      <PageHeader
        title="Sales Order Not Found"
        description="The order could not be loaded for the active factory."
        actions={<Button variant="outline" onClick={() => router.push('/sales/orders')}>Back to orders</Button>}
      />
    )
  }

  return (
    <>
      <PageHeader
        title={order.so_code}
        description={`${order.customers?.customer_name ?? 'Customer'} / ${order.order_date}`}
        actions={<Button variant="outline" onClick={() => router.push('/sales/orders')}>Back to orders</Button>}
      />

      <section className="detail-grid">
        <Card>
          <div className="summary">
            <div>
              <span>Customer</span>
              <strong>{order.customers?.customer_name ?? '-'}</strong>
              {order.customers?.company_name && <p>{order.customers.company_name}</p>}
            </div>
            <div>
              <span>Order Date</span>
              <strong>{order.order_date}</strong>
            </div>
            <div>
              <span>Expected Date</span>
              <strong>{order.expected_date ?? '-'}</strong>
            </div>
            <div>
              <span>Status</span>
              <Badge variant={STATUS_BADGE[order.status ?? 'draft'] ?? 'default'}>
                {order.status ?? 'draft'}
              </Badge>
            </div>
            <div>
              <span>Order Total</span>
              <strong>{formatMoney(totalAmount)}</strong>
            </div>
          </div>
        </Card>

        <Card>
          <h2>Status</h2>
          <div className="status-row">
            <select value={status} onChange={(event) => setStatus(event.target.value)} disabled={!canUpdate}>
              {ORDER_STATUSES.map((statusOption) => (
                <option key={statusOption} value={statusOption} disabled={!canTransitionSalesStatus(order.status, statusOption)}>
                  {statusOption}
                </option>
              ))}
            </select>
            <Button title={!canUpdate ? 'You do not have permission to update records.' : undefined} onClick={handleStatusSave} loading={savingStatus} disabled={!canUpdate}>
              Save
            </Button>
          </div>
        </Card>
      </section>

      <section className="line-layout">
        <Card>
          <h2>Add Line Item</h2>
          <form onSubmit={handleAddItem}>
            <label>
              <span>Product</span>
              <select
                value={itemForm.product_id}
                onChange={(event) => setItemForm((prev) => ({ ...prev, product_id: event.target.value }))}
                required
                disabled={!canEditLines || products.length === 0}
              >
                {products.length === 0 ? (
                  <option value="">No products available</option>
                ) : (
                  products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product_code} - {product.product_name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label>
              <span>Packaging</span>
              <select
                value={itemForm.packaging_type}
                onChange={(event) => setItemForm((prev) => ({ ...prev, packaging_type: event.target.value }))}
                disabled={!canEditLines}
              >
                {PACKAGING_TYPES.map((packagingType) => (
                  <option key={packagingType} value={packagingType}>{packagingType}</option>
                ))}
              </select>
            </label>

            <Input label="Quantity" type="number" min="0" step="0.01" value={itemForm.ordered_qty} onChange={(event) => setItemForm((prev) => ({ ...prev, ordered_qty: event.target.value }))} required disabled={!canEditLines} />
            <Input label="Unit price" type="number" min="0" step="0.01" value={itemForm.unit_price} onChange={(event) => setItemForm((prev) => ({ ...prev, unit_price: event.target.value }))} required disabled={!canEditLines} />
            <Input label="Discount %" type="number" min="0" max="100" step="0.01" value={itemForm.discount_pct} onChange={(event) => setItemForm((prev) => ({ ...prev, discount_pct: event.target.value }))} disabled={!canEditLines} />
            {error && <p className="form-error">{error}</p>}
            <Button title={!canEditLines ? 'You do not have permission to edit this document.' : undefined} type="submit" loading={savingItem} disabled={!canEditLines || products.length === 0} fullWidth>
              Add item
            </Button>
          </form>
        </Card>

        <div>
          <DataTable
            columns={itemColumns}
            data={items}
            loading={loading}
            emptyTitle="No line items"
            emptyMessage="Add products to complete this sales order."
          />
          <Card className="total-card">
            <span>Total</span>
            <strong>{formatMoney(totalAmount)}</strong>
          </Card>
        </div>
      </section>

      <style jsx>{`
        .detail-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: var(--space-6);
          margin-bottom: var(--space-6);
          align-items: start;
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: var(--space-4);
        }

        .summary div {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .summary span,
        label span,
        .total-card :global(span) {
          color: var(--text-secondary);
          font-size: var(--text-xs);
          font-weight: var(--font-semibold);
          text-transform: uppercase;
          letter-spacing: var(--tracking-wider);
        }

        .summary strong {
          color: var(--text-primary);
          font-size: var(--text-sm);
        }

        .summary p {
          margin: 0;
          color: var(--text-secondary);
          font-size: var(--text-xs);
        }

        h2 {
          margin: 0 0 var(--space-4);
          font-size: var(--text-lg);
        }

        .status-row {
          display: flex;
          gap: var(--space-3);
        }

        .line-layout {
          display: grid;
          grid-template-columns: 360px minmax(0, 1fr);
          gap: var(--space-6);
          align-items: start;
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

        .total-card {
          margin-top: var(--space-4);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .total-card :global(strong) {
          color: var(--text-primary);
          font-size: var(--text-xl);
        }

        @media (max-width: 1100px) {
          .summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 920px) {
          .detail-grid,
          .line-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}

function getLineAmount(item: SalesOrderItem) {
  const qty = Number(item.ordered_qty ?? 0)
  const unitPrice = Number(item.unit_price ?? 0)
  const discountPct = Number(item.discount_pct ?? 0)
  return qty * unitPrice * (1 - discountPct / 100)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}
