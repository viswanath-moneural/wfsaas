export const SALES_STATUSES = ['draft', 'confirmed', 'dispatched', 'invoiced', 'paid', 'cancelled'] as const
export const PURCHASE_STATUSES = ['draft', 'approved', 'received', 'closed', 'cancelled'] as const

export type SalesStatus = (typeof SALES_STATUSES)[number]
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]
const SALES_TRANSITIONS: Record<SalesStatus, SalesStatus[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['dispatched', 'invoiced', 'cancelled'],
  dispatched: ['invoiced', 'cancelled'],
  invoiced: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
}

const PURCHASE_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
}

export function toNumber(value: unknown): number {
  return Number(value ?? 0)
}

export function calcLineAmount(qty: number, unitPrice: number, discountPct = 0) {
  const net = qty * unitPrice
  return net - net * (discountPct / 100)
}

export function calcInvoiceTotals(lines: Array<{ qty: number; unit_price: number; discount_pct?: number; gst_rate?: number }>) {
  const subtotal = lines.reduce((sum, line) => sum + (line.qty * line.unit_price), 0)
  const discount = lines.reduce((sum, line) => sum + ((line.qty * line.unit_price) * ((line.discount_pct ?? 0) / 100)), 0)
  const taxable = subtotal - discount
  const gst = lines.reduce((sum, line) => {
    const lineNet = calcLineAmount(line.qty, line.unit_price, line.discount_pct ?? 0)
    return sum + (lineNet * ((line.gst_rate ?? 0) / 100))
  }, 0)

  return {
    subtotal,
    discount,
    taxable,
    gst,
    total: taxable + gst,
  }
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

export function canTransitionSalesStatus(from: string | null | undefined, to: string) {
  const current = (from ?? 'draft') as SalesStatus
  if (!(current in SALES_TRANSITIONS)) return false
  return SALES_TRANSITIONS[current].includes(to as SalesStatus) || current === to
}

export function canTransitionPurchaseStatus(from: string | null | undefined, to: string) {
  const current = (from ?? 'draft') as PurchaseStatus
  if (!(current in PURCHASE_TRANSITIONS)) return false
  return PURCHASE_TRANSITIONS[current].includes(to as PurchaseStatus) || current === to
}

export function isSalesEditable(status: string | null | undefined) {
  return ['draft', 'confirmed'].includes(String(status ?? 'draft'))
}

export function isPurchaseEditable(status: string | null | undefined) {
  return ['draft', 'approved'].includes(String(status ?? 'draft'))
}
