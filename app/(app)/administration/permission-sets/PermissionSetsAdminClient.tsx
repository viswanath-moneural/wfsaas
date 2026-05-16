'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminPermissionSets } from '@/app/actions/admin'

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export default function PermissionSetsAdminClient({ initialPermissionSets, assignedCounts, lookups }: { initialPermissionSets: any[]; assignedCounts: Record<string, number>; lookups: any }) {
  const router = useRouter()
  const [permissionSets, setPermissionSets] = useState(initialPermissionSets)
  const [counts, setCounts] = useState(assignedCounts)
  const [panelOpen, setPanelOpen] = useState(false)
  const [form, setForm] = useState({ label: '', name: '', description: '', org_id: lookups.currentUser?.org_id ?? '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()
  const isSuperadmin = lookups.currentUser?.is_superadmin === true

  function refresh() {
    startTransition(async () => {
      const [setsResult, lookupsResult] = await Promise.all([adminPermissionSets.getAll(), adminPermissionSets.getLookups()])
      if (setsResult.data) setPermissionSets(setsResult.data)
      if (lookupsResult.data?.assignments) {
        const next = lookupsResult.data.assignments.reduce((acc: Record<string, number>, assignment: any) => {
          acc[assignment.permission_set_id] = (acc[assignment.permission_set_id] ?? 0) + 1
          return acc
        }, {})
        setCounts(next)
      }
    })
  }

  function openCreate() {
    setForm({ label: '', name: '', description: '', org_id: lookups.currentUser?.org_id ?? '' })
    setPanelOpen(true)
    setError('')
  }

  function submit() {
    startTransition(async () => {
      const label = form.label.trim()
      if (!label) {
        setError('Permission set name is required.')
        return
      }
      const result = await adminPermissionSets.create({
        org_id: form.org_id,
        label,
        name: form.name || slugify(label),
        description: form.description || null,
      })
      if (result.error || !result.data) {
        setError(result.error ?? 'Create failed.')
        return
      }
      setPanelOpen(false)
      setSuccess('Permission set created.')
      refresh()
      router.push(`/administration/permission-sets/${result.data.id}`)
    })
  }

  return (
    <div className="admin-permission-sets-page">
      <div className="admin-page-header">
        <div>
          <h1>Permission Sets</h1>
          <p>Grant additive module permissions on top of a user's profile.</p>
        </div>
        <Button onClick={openCreate}>New Permission Set</Button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="super-table">
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Users Assigned</th><th>Actions</th></tr></thead>
          <tbody>
            {permissionSets.map((set) => (
              <tr key={set.id}>
                <td><button className="text-link table-link-button" onClick={() => router.push(`/administration/permission-sets/${set.id}`)}>{set.label}</button></td>
                <td>{set.description ?? '-'}</td>
                <td>{counts[set.id] ?? 0}</td>
                <td><Button size="xs" variant="outline" onClick={() => router.push(`/administration/permission-sets/${set.id}`)}>Open</Button></td>
              </tr>
            ))}
            {!permissionSets.length && <tr><td colSpan={4}>No permission sets found.</td></tr>}
          </tbody>
        </table>
      </div>

      {panelOpen && (
        <div className="slide-over" role="dialog" aria-modal="true" aria-label="Create permission set">
          <button className="slide-over__backdrop" onClick={() => setPanelOpen(false)} aria-label="Close panel" />
          <div className="slide-over__panel">
            <div className="slide-over__header"><h2>New Permission Set</h2><Button size="sm" variant="ghost" onClick={() => setPanelOpen(false)}>Close</Button></div>
            <div className="slide-over__body">
              <Input label="Name" required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value, name: slugify(event.target.value) })} />
              <Input label="API Name" required value={form.name} onChange={(event) => setForm({ ...form, name: slugify(event.target.value) })} />
              <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              {isSuperadmin && <label>Organisation<select value={form.org_id} onChange={(event) => setForm({ ...form, org_id: event.target.value })}>{(lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
            </div>
            <div className="slide-over__footer"><Button variant="outline" onClick={() => setPanelOpen(false)}>Cancel</Button><Button loading={isPending} onClick={submit}>Create</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}





