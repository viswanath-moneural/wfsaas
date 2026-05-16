'use client'

import { useState, useTransition } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { superadminFactories, superadminModules, superadminOrganisations } from '@/app/actions/superadmin'

const tabs = ['Overview', 'Factories', 'Users', 'Modules', 'Audit Log'] as const
const plans = ['Free', 'Pro', 'Enterprise'] as const

export default function OrganisationDetailClient({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData)
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Overview')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [overview, setOverview] = useState({
    name: data.organisation.name ?? '',
    slug: data.organisation.slug ?? '',
    plan: data.organisation.plan ?? 'Free',
  })
  const [factoryForm, setFactoryForm] = useState({ name: '', phone: '', address: '' })
  const [suspendReason, setSuspendReason] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showSuspend, setShowSuspend] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  async function refresh() {
    const refreshed = await superadminOrganisations.getDetails(data.organisation.id)
    if (refreshed.data) setData(refreshed.data)
  }

  function run(action: () => Promise<void>) {
    setError('')
    setMessage('')
    startTransition(async () => {
      try {
        await action()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed.')
      }
    })
  }

  function saveOverview() {
    run(async () => {
      const result = await superadminOrganisations.updateDetails(data.organisation.id, {
        name: overview.name,
        slug: overview.slug,
        plan: overview.plan as 'Free' | 'Pro' | 'Enterprise',
      })
      if (result.error) throw new Error(result.error)
      setMessage('Organisation updated.')
      await refresh()
    })
  }

  function toggleStatus() {
    if (data.organisation.is_active) {
      setShowSuspend(true)
      return
    }
    run(async () => {
      const result = await superadminOrganisations.activate(data.organisation.id)
      if (result.error) throw new Error(result.error)
      setMessage('Organisation activated.')
      await refresh()
    })
  }

  function confirmSuspend() {
    run(async () => {
      const result = await superadminOrganisations.suspendWithReason(data.organisation.id, suspendReason)
      if (result.error) throw new Error(result.error)
      setShowSuspend(false)
      setSuspendReason('')
      setMessage('Organisation suspended.')
      await refresh()
    })
  }

  function confirmDelete() {
    run(async () => {
      if (deleteConfirm !== data.organisation.name) throw new Error('Type the organisation name exactly to confirm deletion.')
      const result = await superadminOrganisations.deleteOrganisation(data.organisation.id)
      if (result.error) throw new Error(result.error)
      window.location.href = '/superadmin/organisations'
    })
  }

  function addFactory() {
    run(async () => {
      const result = await superadminFactories.create({
        org_id: data.organisation.id,
        name: factoryForm.name,
        phone: factoryForm.phone,
        address: factoryForm.address,
      })
      if (result.error) throw new Error(result.error)
      setFactoryForm({ name: '', phone: '', address: '' })
      setMessage('Factory added.')
      await refresh()
    })
  }

  function deleteFactory(id: string) {
    run(async () => {
      const result = await superadminFactories.deleteFactory(id)
      if (result.error) throw new Error(result.error)
      setMessage('Factory deleted.')
      await refresh()
    })
  }

  function toggleModule(moduleKey: string, enabled: boolean) {
    run(async () => {
      const result = await superadminModules.toggleForOrg(data.organisation.id, moduleKey, enabled)
      if (result.error) throw new Error(result.error)
      setMessage('Module updated.')
      await refresh()
    })
  }

  return (
    <div className="org-detail">
      <div className="org-detail__header">
        <div>
          <h1>{data.organisation.name}</h1>
          <Badge variant={data.organisation.is_active ? 'success' : 'danger'}>
            {data.organisation.is_active ? 'Active' : 'Suspended'}
          </Badge>
        </div>
        <div>
          <Button variant="outline" onClick={() => setActiveTab('Overview')}>Edit</Button>
          <Button variant={data.organisation.is_active ? 'danger' : 'success'} onClick={toggleStatus}>
            {data.organisation.is_active ? 'Suspend' : 'Activate'}
          </Button>
          <Button variant="danger" onClick={() => setShowDelete(true)}>Delete</Button>
        </div>
      </div>

      <div className="tab-bar">
        {tabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {message && <div className="success-banner">{message}</div>}
      {error && <div className="form-error">{error}</div>}

      {activeTab === 'Overview' && (
        <section className="detail-panel">
          <div className="form-grid">
            <Input label="Name" value={overview.name} onChange={(event) => setOverview({ ...overview, name: event.target.value })} />
            <Input label="Slug" value={overview.slug} onChange={(event) => setOverview({ ...overview, slug: event.target.value })} />
            <label>
              Plan
              <select value={overview.plan} onChange={(event) => setOverview({ ...overview, plan: event.target.value })}>
                {plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
              </select>
            </label>
            <Input label="Created Date" disabled value={data.organisation.created_at ? new Date(data.organisation.created_at).toLocaleString('en-IN') : '-'} />
          </div>
          <Button loading={isPending} onClick={saveOverview}>Save Overview</Button>
        </section>
      )}

      {activeTab === 'Factories' && (
        <section className="detail-panel">
          <div className="form-grid">
            <Input label="Factory Name" value={factoryForm.name} onChange={(event) => setFactoryForm({ ...factoryForm, name: event.target.value })} />
            <Input label="Phone" value={factoryForm.phone} onChange={(event) => setFactoryForm({ ...factoryForm, phone: event.target.value })} />
            <Input label="Address" value={factoryForm.address} onChange={(event) => setFactoryForm({ ...factoryForm, address: event.target.value })} />
          </div>
          <Button loading={isPending} onClick={addFactory}>Add Factory</Button>
          <RecordTable rows={data.factories} columns={['name', 'phone', 'address', 'is_active']} onDelete={deleteFactory} />
        </section>
      )}

      {activeTab === 'Users' && (
        <section className="detail-panel">
          <RecordTable rows={data.users} columns={['full_name', 'email', 'role', 'is_active']} />
        </section>
      )}

      {activeTab === 'Modules' && (
        <section className="detail-panel module-list">
          {data.modules.map((moduleRow: any) => (
            <label key={moduleRow.id ?? moduleRow.module_key} className="module-toggle">
              <span>
                <strong>{moduleRow.module_key}</strong>
                <small>{moduleRow.is_enabled ? 'Enabled' : 'Disabled'}</small>
              </span>
              <input type="checkbox" checked={moduleRow.is_enabled} onChange={(event) => toggleModule(moduleRow.module_key, event.target.checked)} />
            </label>
          ))}
          {!data.modules.length && <p>No modules configured for this organisation.</p>}
        </section>
      )}

      {activeTab === 'Audit Log' && (
        <section className="detail-panel">
          <RecordTable rows={data.auditLog} columns={['action', 'table_name', 'changed_by', 'changed_at']} />
        </section>
      )}

      {showSuspend && (
        <ConfirmModal title="Suspend Organisation" onClose={() => setShowSuspend(false)}>
          <Input label="Suspension Reason" value={suspendReason} onChange={(event) => setSuspendReason(event.target.value)} />
          <Button variant="danger" loading={isPending} onClick={confirmSuspend}>Suspend</Button>
        </ConfirmModal>
      )}

      {showDelete && (
        <ConfirmModal title="Delete Organisation" onClose={() => setShowDelete(false)}>
          <p>Type <strong>{data.organisation.name}</strong> to permanently delete this organisation.</p>
          <Input label="Confirmation" value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} />
          <Button variant="danger" loading={isPending} onClick={confirmDelete}>Delete Organisation</Button>
        </ConfirmModal>
      )}
    </div>
  )
}

function RecordTable({ rows, columns, onDelete }: { rows: any[]; columns: string[]; onDelete?: (id: string) => void }) {
  return (
    <div className="super-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}
            {onDelete && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column}>{typeof row[column] === 'boolean' ? (row[column] ? 'Yes' : 'No') : String(row[column] ?? '-')}</td>
              ))}
              {onDelete && <td><Button size="xs" variant="danger" onClick={() => onDelete(row.id)}>Delete</Button></td>}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={columns.length + (onDelete ? 1 : 0)}>No records found.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function ConfirmModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-label={title}>
      <button className="modal-shell__backdrop" onClick={onClose} aria-label="Close modal" />
      <div className="modal-shell__panel">
        <div className="modal-shell__header">
          <h2>{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="modal-shell__body">{children}</div>
      </div>
    </div>
  )
}
