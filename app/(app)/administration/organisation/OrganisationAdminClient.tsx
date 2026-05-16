'use client'

import { useMemo, useState, useTransition } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminOrganisations } from '@/app/actions/admin'

const MONTHS = [
  ['1', 'January'], ['2', 'February'], ['3', 'March'], ['4', 'April'],
  ['5', 'May'], ['6', 'June'], ['7', 'July'], ['8', 'August'],
  ['9', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December'],
]

export default function OrganisationAdminClient({ organisations, currentUser }: { organisations: any[]; currentUser: any }) {
  const [orgs, setOrgs] = useState(organisations)
  const [selectedOrgId, setSelectedOrgId] = useState(organisations[0]?.id ?? '')
  const selectedOrg = useMemo(() => orgs.find((org) => org.id === selectedOrgId) ?? orgs[0], [orgs, selectedOrgId])
  const [form, setForm] = useState(() => makeForm(selectedOrg))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()
  const isSuperadmin = currentUser?.is_superadmin === true
  const canEdit = isSuperadmin || ['owner', 'admin'].includes(String(currentUser?.role?.name ?? '').toLowerCase())

  function selectOrg(id: string) {
    const next = orgs.find((org) => org.id === id)
    setSelectedOrgId(id)
    setForm(makeForm(next))
    setError('')
    setSuccess('')
  }

  function save() {
    if (!selectedOrg || !canEdit) return
    setError('')
    setSuccess('')
    startTransition(async () => {
      const result = await adminOrganisations.update(selectedOrg.id, {
        name: form.name,
        logo_url: form.logo_url || null,
        plan: isSuperadmin ? form.plan : selectedOrg.plan,
        country: form.country || null,
        timezone: form.timezone || 'UTC',
        currency: form.currency || 'INR',
        fiscal_year_start: Number(form.fiscal_year_start || 4),
      })
      if (result.error || !result.data) {
        setError(result.error ?? 'Organisation update failed.')
        return
      }
      setOrgs((current) => current.map((org) => org.id === result.data.id ? result.data : org))
      setSuccess('Organisation saved.')
    })
  }

  function suspend() {
    if (!selectedOrg || !canEdit) return
    const note = window.prompt('Suspension reason')
    if (!note) return
    startTransition(async () => {
      const result = await adminOrganisations.suspend(selectedOrg.id, note)
      if (result.error || !result.data) setError(result.error ?? 'Suspend failed.')
      else {
        setOrgs((current) => current.map((org) => org.id === result.data.id ? result.data : org))
        setSuccess('Organisation suspended.')
      }
    })
  }

  function activate() {
    if (!selectedOrg || !isSuperadmin) return
    startTransition(async () => {
      const result = await adminOrganisations.activate(selectedOrg.id)
      if (result.error || !result.data) setError(result.error ?? 'Activate failed.')
      else {
        setOrgs((current) => current.map((org) => org.id === result.data.id ? result.data : org))
        setSuccess('Organisation activated.')
      }
    })
  }

  if (!selectedOrg) {
    return <section className="admin-placeholder"><span>Company Settings</span><h1>Organisation</h1><p>No organisation found for this user.</p></section>
  }

  return (
    <div className="admin-organisation-page">
      <div className="admin-page-header">
        <div>
          <h1>Organisation</h1>
          <p>Manage company identity, localisation, fiscal settings, and plan information.</p>
        </div>
        <Badge variant={selectedOrg.is_active === false ? 'danger' : 'success'}>{selectedOrg.is_active === false ? 'Suspended' : 'Active'}</Badge>
      </div>

      {isSuperadmin && (
        <div className="admin-filter-bar admin-filter-bar--compact">
          <label>Organisation<select value={selectedOrg.id} onChange={(event) => selectOrg(event.target.value)}>{orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <section className="detail-panel">
        <div className="org-logo-row">
          <div className="org-logo-preview">{form.logo_url ? <img src={form.logo_url} alt="" /> : <span>{form.name?.slice(0, 2).toUpperCase()}</span>}</div>
          <div>
            <Input label="Logo URL" value={form.logo_url} disabled={!canEdit} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} />
            <label className="file-upload-label">Logo upload<input type="file" accept="image/*" disabled={!canEdit} onChange={(event) => {
              const file = event.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => setForm((current) => ({ ...current, logo_url: String(reader.result ?? '') }))
              reader.readAsDataURL(file)
            }} /></label>
          </div>
        </div>
        <div className="form-grid">
          <Input label="Company Name" value={form.name} disabled={!canEdit} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input label="Slug" value={form.slug} disabled helper="Slug is immutable after creation." />
          <label>Plan<select value={form.plan} disabled={!isSuperadmin} onChange={(event) => setForm({ ...form, plan: event.target.value })}><option value="free">Free</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select></label>
          <Input label="Country" value={form.country} disabled={!canEdit} onChange={(event) => setForm({ ...form, country: event.target.value })} />
          <Input label="Timezone" value={form.timezone} disabled={!canEdit} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
          <Input label="Currency" value={form.currency} disabled={!canEdit} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} />
          <label>Fiscal Year Start Month<select value={form.fiscal_year_start} disabled={!canEdit} onChange={(event) => setForm({ ...form, fiscal_year_start: event.target.value })}>{MONTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="sticky-actions"><Button loading={isPending} disabled={!canEdit} onClick={save}>Save Organisation</Button></div>
      </section>

      <section className="detail-panel danger-zone">
        <h2>Danger Zone</h2>
        <p>Suspend disables the organisation without deleting transactional data.</p>
        <div className="row-actions">
          <Button variant="danger" disabled={!canEdit || selectedOrg.is_active === false} onClick={suspend}>Suspend Account</Button>
          {isSuperadmin && <Button variant="outline" disabled={selectedOrg.is_active !== false} onClick={activate}>Activate Account</Button>}
        </div>
      </section>
    </div>
  )
}

function makeForm(org: any) {
  return {
    name: org?.name ?? '',
    slug: org?.slug ?? '',
    logo_url: org?.logo_url ?? '',
    plan: org?.plan ?? 'free',
    country: org?.country ?? '',
    timezone: org?.timezone ?? 'UTC',
    currency: org?.currency ?? 'INR',
    fiscal_year_start: String(org?.fiscal_year_start ?? 4),
  }
}





