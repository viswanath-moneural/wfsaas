'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { superadminRoles } from '@/app/actions/superadmin'

const systemNames = new Set(['superadmin', 'owner', 'admin', 'staff'])

export default function RolesClient({ roles, organisations }: { roles: any[]; organisations: any[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(roles)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    role_name: '',
    description: '',
    scope: 'org',
    org_id: organisations[0]?.id ?? '',
    clone_from_role_id: '',
  })

  const sortedRows = useMemo(() => rows.slice().sort((a, b) => String(a.role_name).localeCompare(String(b.role_name))), [rows])

  function createRole() {
    setError('')
    startTransition(async () => {
      const result = await superadminRoles.createRoleWithPermissions({
        role_name: form.role_name,
        description: form.description,
        scope: form.scope as 'global' | 'org',
        org_id: form.org_id,
        clone_from_role_id: form.clone_from_role_id || null,
      })
      if (result.error || !result.data) {
        setError(result.error ?? 'Failed to create role.')
        return
      }
      setModalOpen(false)
      router.push(`/superadmin/roles/${result.data.id}`)
    })
  }

  function cloneRole(id: string) {
    setError('')
    startTransition(async () => {
      const result = await superadminRoles.cloneRoleDefaultName(id)
      if (result.error || !result.data) {
        setError(result.error ?? 'Failed to clone role.')
        return
      }
      router.push(`/superadmin/roles/${result.data.id}`)
    })
  }

  async function deleteRole(id: string) {
    const result = await superadminRoles.deleteRole(id)
    if (result.error) {
      setError(result.error)
      return
    }
    const refreshed = await superadminRoles.listWithMetrics()
    if (refreshed.data) setRows(refreshed.data)
  }

  return (
    <div className="roles-page">
      <div className="org-page__header">
        <div>
          <h1>Roles & Permissions</h1>
          <p>Manage platform and organisation roles with Salesforce-style permission sets.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New Role</Button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="super-table">
        <table>
          <thead><tr><th>Role Name</th><th>Type</th><th>Org Scope</th><th>User Count</th><th>Actions</th></tr></thead>
          <tbody>
            {sortedRows.map((role) => {
              const locked = role.is_system || systemNames.has(String(role.role_name ?? '').toLowerCase())
              return (
                <tr key={role.id}>
                  <td><Link href={`/superadmin/roles/${role.id}`}>{locked ? 'Lock ' : ''}{role.role_name}</Link></td>
                  <td><Badge variant={locked ? 'slate' : 'info'}>{locked ? 'System' : 'Custom'}</Badge></td>
                  <td>{role.organisations?.name ?? 'Global'}</td>
                  <td>{role.user_count ?? 0}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="text-link" href={`/superadmin/roles/${role.id}`}>Permissions</Link>
                      <Button size="xs" variant="outline" loading={isPending} onClick={() => cloneRole(role.id)}>Clone Role</Button>
                      <Button size="xs" variant="danger" disabled={locked} onClick={() => deleteRole(role.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!sortedRows.length && <tr><td colSpan={5}>No roles found.</td></tr>}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Create role">
          <button className="modal-shell__backdrop" onClick={() => setModalOpen(false)} aria-label="Close modal" />
          <div className="modal-shell__panel">
            <div className="modal-shell__header">
              <h2>New Role</h2>
              <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Close</Button>
            </div>
            <div className="modal-shell__body">
              <Input label="Role Name" value={form.role_name} onChange={(event) => setForm({ ...form, role_name: event.target.value })} />
              <Input label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              <label>Scope<select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })}>
                <option value="org">Org-specific</option>
                <option value="global">Global</option>
              </select></label>
              {form.scope === 'org' && (
                <label>Organisation<select value={form.org_id} onChange={(event) => setForm({ ...form, org_id: event.target.value })}>
                  {organisations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select></label>
              )}
              <label>Clone Permissions From<select value={form.clone_from_role_id} onChange={(event) => setForm({ ...form, clone_from_role_id: event.target.value })}>
                <option value="">Start blank</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.role_name} - {role.organisations?.name ?? 'Global'}</option>)}
              </select></label>
              {error && <div className="form-error">{error}</div>}
              <Button loading={isPending} onClick={createRole}>Create Role</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}





