'use client'

import { useMemo, useState, useTransition } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminBusinessUnits } from '@/app/actions/admin'

function emptyForm(orgId: string) {
  return {
    id: '',
    org_id: orgId,
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    country: '',
    pincode: '',
    gstin: '',
    pan: '',
    is_active: true,
    is_default: false,
  }
}

export default function BusinessUnitsAdminClient({ initialBusinessUnits, lookups }: { initialBusinessUnits: any[]; lookups: any }) {
  const [businessUnits, setBusinessUnits] = useState(initialBusinessUnits)
  const [selectedOrgId, setSelectedOrgId] = useState(lookups.currentUser?.is_superadmin ? lookups.organisations?.[0]?.id ?? '' : lookups.currentUser?.org_id ?? '')
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingBusinessUnit, setEditingBusinessUnit] = useState<any | null>(null)
  const [form, setForm] = useState(emptyForm(selectedOrgId))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()
  const isSuperadmin = lookups.currentUser?.is_superadmin === true
  const visibleBusinessUnits = useMemo(() => businessUnits.filter((businessUnit) => !selectedOrgId || businessUnit.org_id === selectedOrgId), [businessUnits, selectedOrgId])

  function refresh() {
    startTransition(async () => {
      const result = await adminBusinessUnits.getAll(isSuperadmin ? undefined : lookups.currentUser?.org_id)
      if (result.data) setBusinessUnits(result.data)
      if (result.error) setError(result.error)
    })
  }

  function openCreate() {
    setEditingBusinessUnit(null)
    setForm(emptyForm(selectedOrgId))
    setPanelOpen(true)
    setError('')
  }

  function openEdit(businessUnit: any) {
    setEditingBusinessUnit(businessUnit)
    setForm({
      id: businessUnit.id,
      org_id: businessUnit.org_id,
      name: businessUnit.name ?? '',
      code: businessUnit.code ?? '',
      address: businessUnit.address ?? '',
      city: businessUnit.city ?? '',
      state: businessUnit.state ?? '',
      country: businessUnit.country ?? '',
      pincode: businessUnit.pincode ?? '',
      gstin: businessUnit.gstin ?? '',
      pan: businessUnit.pan ?? '',
      is_active: businessUnit.is_active !== false,
      is_default: businessUnit.is_default === true,
    })
    setPanelOpen(true)
    setError('')
  }

  function selectOrg(orgId: string) {
    setSelectedOrgId(orgId)
    if (!editingBusinessUnit) setForm(emptyForm(orgId))
  }

  function submit() {
    setError('')
    setSuccess('')
    startTransition(async () => {
      if (!form.name.trim() || !form.code.trim()) {
        setError('Business Unit name and code are required.')
        return
      }
      const payload = {
        org_id: form.org_id,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        country: form.country || null,
        pincode: form.pincode || null,
        gstin: form.gstin || null,
        pan: form.pan || null,
        is_active: form.is_active,
        is_default: form.is_default,
      }
      const result = editingBusinessUnit
        ? await adminBusinessUnits.update(editingBusinessUnit.id, payload)
        : await adminBusinessUnits.create(payload)
      if (result.error || !result.data) {
        setError(result.error ?? 'BusinessUnit save failed.')
        return
      }
      setPanelOpen(false)
      setSuccess(editingBusinessUnit ? 'BusinessUnit updated.' : 'BusinessUnit created.')
      refresh()
    })
  }

  function setDefault(businessUnit: any) {
    startTransition(async () => {
      const result = await adminBusinessUnits.setDefault(businessUnit.id)
      if (result.error) setError(result.error)
      else {
        setSuccess('Default business unit updated.')
        refresh()
      }
    })
  }

  function deleteBusinessUnit(businessUnit: any) {
    if (!window.confirm(`Delete business unit ${businessUnit.name}?`)) return
    startTransition(async () => {
      const result = await adminBusinessUnits.delete(businessUnit.id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  return (
    <div className="admin-business-units-page">
      <div className="admin-page-header">
        <div>
          <h1>Business Units</h1>
          <p>Manage branches, plants, GST identity, and default business-unit context.</p>
        </div>
        <Button onClick={openCreate} disabled={!selectedOrgId}>New Business Unit</Button>
      </div>

      {isSuperadmin && (
        <div className="admin-filter-bar admin-filter-bar--compact">
          <label>Organisation<select value={selectedOrgId} onChange={(event) => selectOrg(event.target.value)}>{(lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="super-table">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>City</th><th>GSTIN</th><th>Default</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            {visibleBusinessUnits.map((businessUnit) => (
              <tr key={businessUnit.id}>
                <td><strong>{businessUnit.code}</strong></td>
                <td>{businessUnit.name}</td>
                <td>{businessUnit.city ?? '-'}</td>
                <td>{businessUnit.gstin ?? '-'}</td>
                <td>{businessUnit.is_default ? <Badge variant="success">Default</Badge> : <Button size="xs" variant="outline" onClick={() => setDefault(businessUnit)}>Set Default</Button>}</td>
                <td><Badge variant={businessUnit.is_active === false ? 'danger' : 'success'}>{businessUnit.is_active === false ? 'Inactive' : 'Active'}</Badge></td>
                <td><div className="row-actions"><Button size="xs" variant="outline" onClick={() => openEdit(businessUnit)}>Edit</Button><Button size="xs" variant="danger" onClick={() => deleteBusinessUnit(businessUnit)}>Delete</Button></div></td>
              </tr>
            ))}
            {!visibleBusinessUnits.length && <tr><td colSpan={7}>No business units found for this organisation.</td></tr>}
          </tbody>
        </table>
      </div>

      {panelOpen && (
        <div className="slide-over" role="dialog" aria-modal="true" aria-label={editingBusinessUnit ? 'Edit business unit' : 'Create business unit'}>
          <button className="slide-over__backdrop" onClick={() => setPanelOpen(false)} aria-label="Close panel" />
          <div className="slide-over__panel">
            <div className="slide-over__header"><h2>{editingBusinessUnit ? 'Edit Business Unit' : 'New Business Unit'}</h2><Button size="sm" variant="ghost" onClick={() => setPanelOpen(false)}>Close</Button></div>
            <div className="slide-over__body">
              {isSuperadmin && <label>Organisation<select value={form.org_id} disabled={!!editingBusinessUnit} onChange={(event) => setForm({ ...form, org_id: event.target.value })}>{(lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
              <div className="form-grid">
                <Input label="Name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                <Input label="Code" required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />
              </div>
              <Input label="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              <div className="form-grid">
                <Input label="City" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
                <Input label="State" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
                <Input label="Country" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
                <Input label="Pincode" value={form.pincode} onChange={(event) => setForm({ ...form, pincode: event.target.value })} />
                <Input label="GSTIN" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })} />
                <Input label="PAN" value={form.pan} onChange={(event) => setForm({ ...form, pan: event.target.value.toUpperCase() })} />
              </div>
              <label className="toggle-row"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Active</label>
              <label className="toggle-row"><input type="checkbox" checked={form.is_default} onChange={(event) => setForm({ ...form, is_default: event.target.checked })} /> Set as Default</label>
            </div>
            <div className="slide-over__footer"><Button variant="outline" onClick={() => setPanelOpen(false)}>Cancel</Button><Button loading={isPending} onClick={submit}>Save Business Unit</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}














