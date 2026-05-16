'use client'

import { useMemo, useState, useTransition } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminNumberSeries } from '@/app/actions/admin'

const GROUPS = [
  {
    key: 'sales',
    label: 'SALES',
    documents: [
      ['sales_order', 'Sales Order'],
      ['invoice', 'Invoice'],
      ['dispatch', 'Dispatch'],
      ['customer_payment', 'Customer Payment'],
    ],
  },
  {
    key: 'purchases',
    label: 'PURCHASES',
    documents: [
      ['purchase_order', 'Purchase Order'],
      ['grn', 'GRN'],
      ['vendor_payment', 'Vendor Payment'],
    ],
  },
  {
    key: 'inventory',
    label: 'INVENTORY',
    documents: [
      ['stock_adjustment', 'Stock Adjustment'],
      ['stock_movement', 'Stock Movement'],
    ],
  },
  {
    key: 'hr',
    label: 'HR',
    documents: [
      ['employee_code', 'Employee Code'],
    ],
  },
]

const DOCUMENT_LABELS = Object.fromEntries(GROUPS.flatMap((group) => group.documents))

function emptyForm(orgId: string) {
  return {
    id: '',
    org_id: orgId,
    business_unit_id: '',
    module_key: 'sales',
    document_type: 'sales_order',
    prefix: 'SO',
    suffix: '',
    separator: '-',
    padding_digits: 5,
    start_value: 1,
    current_value: 0,
    reset_frequency: 'never',
    is_active: true,
  }
}

function previewFor(form: any) {
  const next = Number(form.current_value ?? 0) + 1
  return `${form.prefix || ''}${form.separator || ''}${String(next).padStart(Number(form.padding_digits || 5), '0')}${form.suffix || ''}`
}

export default function NumberSeriesAdminClient({ initialSeries, lookups }: { initialSeries: any[]; lookups: any }) {
  const [seriesRows, setSeriesRows] = useState(initialSeries)
  const [selectedOrgId, setSelectedOrgId] = useState(lookups.currentUser?.is_superadmin ? lookups.organisations?.[0]?.id ?? '' : lookups.currentUser?.org_id ?? '')
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<any | null>(null)
  const [form, setForm] = useState(emptyForm(selectedOrgId))
  const [resetTarget, setResetTarget] = useState<any | null>(null)
  const [resetText, setResetText] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()
  const isSuperadmin = lookups.currentUser?.is_superadmin === true

  const visibleSeries = useMemo(() => seriesRows.filter((row) => !selectedOrgId || row.org_id === selectedOrgId), [selectedOrgId, seriesRows])
  const businessUnits = (lookups.businessUnits ?? []).filter((businessUnit: any) => !form.org_id || businessUnit.org_id === form.org_id)
  const orgBusinessUnits = (lookups.businessUnits ?? []).filter((businessUnit: any) => !selectedOrgId || businessUnit.org_id === selectedOrgId)
  const documentsForModule = GROUPS.find((group) => group.key === form.module_key)?.documents ?? []

  function refresh() {
    startTransition(async () => {
      const result = await adminNumberSeries.getAll(isSuperadmin ? selectedOrgId : lookups.currentUser?.org_id)
      if (result.error) setError(result.error)
      if (result.data) setSeriesRows(result.data)
    })
  }

  function selectOrg(orgId: string) {
    setSelectedOrgId(orgId)
    setForm(emptyForm(orgId))
    startTransition(async () => {
      const result = await adminNumberSeries.getAll(orgId)
      if (result.data) setSeriesRows(result.data)
      if (result.error) setError(result.error)
    })
  }

  function openCreate() {
    setEditingSeries(null)
    setForm(emptyForm(selectedOrgId))
    setError('')
    setPanelOpen(true)
  }

  function openEdit(row: any) {
    setEditingSeries(row)
    setForm({
      id: row.id,
      org_id: row.org_id,
      business_unit_id: row.business_unit_id ?? '',
      module_key: row.module_key ?? 'sales',
      document_type: row.document_type ?? 'sales_order',
      prefix: row.prefix ?? '',
      suffix: row.suffix ?? '',
      separator: row.separator ?? '-',
      padding_digits: row.padding_digits ?? 5,
      start_value: row.start_value ?? 1,
      current_value: row.current_value ?? 0,
      reset_frequency: row.reset_frequency ?? 'never',
      is_active: row.is_active !== false,
    })
    setError('')
    setPanelOpen(true)
  }

  function updateModule(moduleKey: string) {
    const firstDocument = GROUPS.find((group) => group.key === moduleKey)?.documents[0]?.[0] ?? ''
    setForm({ ...form, module_key: moduleKey, document_type: firstDocument, prefix: defaultPrefix(firstDocument) })
  }

  function submit() {
    setError('')
    setSuccess('')
    startTransition(async () => {
      if (!form.document_type || !form.prefix) {
        setError('Document type and prefix are required.')
        return
      }
      const payload = {
        org_id: form.org_id,
        business_unit_id: form.business_unit_id || null,
        module_key: form.module_key,
        document_type: form.document_type,
        prefix: form.prefix,
        suffix: form.suffix || '',
        separator: form.separator,
        padding_digits: Number(form.padding_digits),
        start_value: Number(form.start_value),
        current_value: editingSeries ? Number(form.current_value) : Number(form.start_value) - 1,
        reset_frequency: form.reset_frequency,
        is_active: form.is_active,
      }
      const result = editingSeries
        ? await adminNumberSeries.update(editingSeries.id, payload)
        : await adminNumberSeries.create(payload)
      if (result.error || !result.data) {
        setError(result.error ?? 'Number series save failed.')
        return
      }
      setPanelOpen(false)
      setSuccess(editingSeries ? 'Number series updated.' : 'Number series created.')
      refresh()
    })
  }

  function resetSeries() {
    if (!resetTarget || resetText !== 'RESET') return
    startTransition(async () => {
      const result = await adminNumberSeries.resetSeries(resetTarget.id)
      if (result.error) setError(result.error)
      else {
        setSuccess('Series reset.')
        setResetTarget(null)
        setResetText('')
        refresh()
      }
    })
  }

  function deleteSeries(row: any) {
    if (!window.confirm(`Delete number series for ${row.document_type}?`)) return
    startTransition(async () => {
      const result = await adminNumberSeries.delete(row.id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  return (
    <div className="admin-number-series-page">
      <div className="admin-page-header">
        <div>
          <h1>Number Series</h1>
          <p>Configure document auto-numbering by module, document type, and optional businessUnit scope.</p>
        </div>
        <Button onClick={openCreate} disabled={!selectedOrgId}>New Series</Button>
      </div>

      {isSuperadmin && (
        <div className="admin-filter-bar admin-filter-bar--compact">
          <label>Organisation<select value={selectedOrgId} onChange={(event) => selectOrg(event.target.value)}>{(lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {GROUPS.map((group) => {
        const rows = visibleSeries.filter((row) => row.module_key === group.key || group.documents.some(([type]) => type === row.document_type))
        return (
          <section className="detail-panel" key={group.key}>
            <h2>{group.label}</h2>
            <div className="super-table">
              <table>
                <thead><tr><th>Document Type</th><th>Prefix</th><th>Separator</th><th>Padding</th><th>Current</th><th>Preview</th><th>Reset</th><th>Active</th><th>Actions</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{DOCUMENT_LABELS[row.document_type] ?? row.document_type}{row.businessUnit?.name ? <small className="muted-cell"> {row.businessUnit.name}</small> : null}</td>
                      <td>{row.prefix}</td>
                      <td>{row.separator}</td>
                      <td>{row.padding_digits}</td>
                      <td>{row.current_value}</td>
                      <td><strong>{row.preview ?? previewFor(row)}</strong></td>
                      <td>{row.reset_frequency}</td>
                      <td><Badge variant={row.is_active === false ? 'danger' : 'success'}>{row.is_active === false ? 'Inactive' : 'Active'}</Badge></td>
                      <td><div className="row-actions"><Button size="xs" variant="outline" onClick={() => openEdit(row)}>Edit</Button><Button size="xs" variant="outline" onClick={() => setResetTarget(row)}>Reset</Button><Button size="xs" variant="danger" onClick={() => deleteSeries(row)}>Delete</Button></div></td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={9}>No series configured for this group.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {panelOpen && (
        <div className="slide-over" role="dialog" aria-modal="true" aria-label="Number series form">
          <button className="slide-over__backdrop" onClick={() => setPanelOpen(false)} aria-label="Close panel" />
          <div className="slide-over__panel">
            <div className="slide-over__header"><h2>{editingSeries ? 'Edit Series' : 'New Series'}</h2><Button size="sm" variant="ghost" onClick={() => setPanelOpen(false)}>Close</Button></div>
            <div className="slide-over__body">
              {isSuperadmin && <label>Organisation<select value={form.org_id} disabled={!!editingSeries} onChange={(event) => setForm({ ...form, org_id: event.target.value, business_unit_id: '' })}>{(lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
              <label>Module<select value={form.module_key} onChange={(event) => updateModule(event.target.value)}>{GROUPS.map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}</select></label>
              <label>Document Type*<select value={form.document_type} onChange={(event) => setForm({ ...form, document_type: event.target.value, prefix: defaultPrefix(event.target.value) })}>{documentsForModule.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <div className="form-grid">
                <Input label="Prefix" required value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value.toUpperCase() })} />
                <Input label="Suffix" value={form.suffix} onChange={(event) => setForm({ ...form, suffix: event.target.value.toUpperCase() })} />
                <label>Separator<select value={form.separator} onChange={(event) => setForm({ ...form, separator: event.target.value })}><option value="-">-</option><option value="/">/</option><option value="_">_</option></select></label>
                <label>Padding Digits<select value={form.padding_digits} onChange={(event) => setForm({ ...form, padding_digits: Number(event.target.value) })}>{[3,4,5,6,7,8].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <Input label="Start Value" type="number" value={form.start_value} onChange={(event) => setForm({ ...form, start_value: Number(event.target.value) })} />
                <label>Reset Frequency<select value={form.reset_frequency} onChange={(event) => setForm({ ...form, reset_frequency: event.target.value })}><option value="never">Never</option><option value="yearly">Yearly</option><option value="monthly">Monthly</option></select></label>
              </div>
              <label>Business Unit<select value={form.business_unit_id} onChange={(event) => setForm({ ...form, business_unit_id: event.target.value })}><option value="">Organisation-wide</option>{businessUnits.map((businessUnit: any) => <option key={businessUnit.id} value={businessUnit.id}>{businessUnit.name}</option>)}</select></label>
              <label className="toggle-row"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Active</label>
              <div className="success-box"><strong>Live Preview</strong><span>{previewFor(form)}</span></div>
            </div>
            <div className="slide-over__footer"><Button variant="outline" onClick={() => setPanelOpen(false)}>Cancel</Button><Button loading={isPending} onClick={submit}>Save Series</Button></div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Reset series">
          <button className="modal-shell__backdrop" onClick={() => setResetTarget(null)} aria-label="Close modal" />
          <div className="modal-shell__panel">
            <div className="modal-shell__header"><h2>Reset Series</h2><Button size="sm" variant="ghost" onClick={() => setResetTarget(null)}>Close</Button></div>
            <div className="modal-shell__body">
              <p>Current value will reset to Start Value. This cannot be undone.</p>
              <Input label='Type "RESET" to confirm' value={resetText} onChange={(event) => setResetText(event.target.value)} />
              <Button variant="danger" disabled={resetText !== 'RESET'} loading={isPending} onClick={resetSeries}>Reset Series</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function defaultPrefix(documentType: string) {
  const map: Record<string, string> = {
    sales_order: 'SO',
    invoice: 'INV',
    dispatch: 'DO',
    customer_payment: 'CP',
    purchase_order: 'PO',
    grn: 'GRN',
    vendor_payment: 'VP',
    stock_adjustment: 'SA',
    stock_movement: 'SM',
    employee_code: 'EMP',
  }
  return map[documentType] ?? documentType.slice(0, 3).toUpperCase()
}












