'use client'

import { useMemo, useState, useTransition } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { superadminUsers } from '@/app/actions/superadmin'

const tabs = ['Profile', 'Roles', 'Permissions', 'Activity', 'Sessions'] as const

function initials(name: string | null, email: string | null) {
  const source = name || email || 'User'
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function UserDetailClient({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData)
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Profile')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [profile, setProfile] = useState({
    full_name: data.user.full_name ?? '',
    email: data.user.email ?? '',
    phone: data.user.phone ?? '',
    org_id: data.user.org_id ?? '',
    tenant_id: data.user.tenant_id ?? '',
    is_active: data.user.is_active !== false,
  })
  const [roleId, setRoleId] = useState('')

  const orgFactories = (data.lookups.factories ?? []).filter((factory: any) => factory.org_id === profile.org_id)
  const orgRoles = (data.lookups.roles ?? []).filter((role: any) => role.org_id === profile.org_id)
  const assignedRoleIds = useMemo(() => new Set((data.roles ?? []).map((roleRow: any) => roleRow.role_id)), [data.roles])

  async function refresh() {
    const refreshed = await superadminUsers.getDetails(data.user.id)
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

  function saveProfile() {
    run(async () => {
      const result = await superadminUsers.update(data.user.id, profile)
      if (result.error) throw new Error(result.error)
      setMessage('Profile updated.')
      await refresh()
    })
  }

  function resetPassword() {
    run(async () => {
      const result = await superadminUsers.resetPasswordGenerated(data.user.id)
      if (result.error || !result.data) throw new Error(result.error ?? 'Password reset failed.')
      setPassword(result.data.password)
      setMessage('Password reset.')
    })
  }

  function suspendToggle() {
    run(async () => {
      const result = await superadminUsers.update(data.user.id, { is_active: !data.user.is_active })
      if (result.error) throw new Error(result.error)
      setMessage(data.user.is_active ? 'User suspended.' : 'User activated.')
      await refresh()
    })
  }

  function impersonate() {
    run(async () => {
      const result = await superadminUsers.impersonate(data.user.id)
      if (result.error || !result.data) throw new Error(result.error ?? 'Impersonation failed.')
      window.open(result.data.actionLink, '_blank', 'noopener,noreferrer')
      setMessage('Magic link opened in a new tab.')
    })
  }

  function deleteUser() {
    run(async () => {
      if (deleteConfirm !== data.user.email) throw new Error('Type the user email exactly to confirm deletion.')
      const result = await superadminUsers.deleteUser(data.user.id)
      if (result.error) throw new Error(result.error)
      window.location.href = '/superadmin/users'
    })
  }

  function addRole() {
    run(async () => {
      const result = await superadminUsers.assignRole(data.user.id, roleId)
      if (result.error) throw new Error(result.error)
      setRoleId('')
      setMessage('Role assigned.')
      await refresh()
    })
  }

  function removeRole(userRoleId: string) {
    run(async () => {
      const result = await superadminUsers.removeRole(userRoleId)
      if (result.error) throw new Error(result.error)
      setMessage('Role removed.')
      await refresh()
    })
  }

  function revokeSessions() {
    run(async () => {
      const result = await superadminUsers.revokeSessions(data.user.id)
      if (result.error || !result.data) throw new Error(result.error ?? 'Session revoke failed.')
      setMessage(result.data.message)
    })
  }

  return (
    <div className="user-detail">
      <div className="user-detail__header">
        <div className="avatar">{initials(data.user.full_name, data.user.email)}</div>
        <div>
          <h1>{data.user.full_name ?? data.user.email}</h1>
          <Badge variant={data.user.is_active ? 'success' : 'slate'}>{data.user.is_active ? 'Active' : 'Inactive'}</Badge>
        </div>
        <div className="user-detail__actions">
          <Button variant="outline" onClick={() => setActiveTab('Profile')}>Edit</Button>
          <Button variant="outline" onClick={resetPassword}>Reset Password</Button>
          <Button variant={data.user.is_active ? 'danger' : 'success'} onClick={suspendToggle}>{data.user.is_active ? 'Suspend' : 'Activate'}</Button>
          <Button variant="secondary" onClick={impersonate}>Impersonate</Button>
          <Button variant="danger" onClick={() => setShowDelete(true)}>Delete</Button>
        </div>
      </div>

      <div className="tab-bar">
        {tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </div>
      {message && <div className="success-banner">{message}</div>}
      {error && <div className="form-error">{error}</div>}

      {activeTab === 'Profile' && (
        <section className="detail-panel">
          <div className="form-grid">
            <Input label="Name" value={profile.full_name} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} />
            <Input label="Email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
            <Input label="Phone" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
            <label>Organisation<select value={profile.org_id} onChange={(event) => setProfile({ ...profile, org_id: event.target.value, tenant_id: '' })}>
              {(data.lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select></label>
            <label>Factory<select value={profile.tenant_id ?? ''} onChange={(event) => setProfile({ ...profile, tenant_id: event.target.value })}>
              <option value="">No factory</option>
              {orgFactories.map((factory: any) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}
            </select></label>
            <Input label="Last Login" disabled value={data.user.last_login ? new Date(data.user.last_login).toLocaleString('en-IN') : '-'} />
          </div>
          <label className="toggle-row"><input type="checkbox" checked={profile.is_active} onChange={(event) => setProfile({ ...profile, is_active: event.target.checked })} /> Active</label>
          <Button loading={isPending} onClick={saveProfile}>Save Profile</Button>
        </section>
      )}

      {activeTab === 'Roles' && (
        <section className="detail-panel">
          <div className="inline-form">
            <label>Role<select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
              <option value="">Select role</option>
              {orgRoles.filter((roleRow: any) => !assignedRoleIds.has(roleRow.id)).map((roleRow: any) => <option key={roleRow.id} value={roleRow.id}>{roleRow.role_name}</option>)}
            </select></label>
            <Button disabled={!roleId} onClick={addRole}>Add Role</Button>
          </div>
          <div className="super-table"><table><thead><tr><th>Role</th><th>Description</th><th>Assigned</th><th>Actions</th></tr></thead><tbody>
            {data.roles.map((roleRow: any) => <tr key={roleRow.id}><td><Badge>{roleRow.roles?.role_name}</Badge></td><td>{roleRow.roles?.description ?? '-'}</td><td>{roleRow.assigned_at ? new Date(roleRow.assigned_at).toLocaleDateString('en-IN') : '-'}</td><td><Button size="xs" variant="danger" onClick={() => removeRole(roleRow.id)}>Remove</Button></td></tr>)}
            {!data.roles.length && <tr><td colSpan={4}>No roles assigned.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {activeTab === 'Permissions' && (
        <section className="detail-panel">
          <div className="super-table"><table><thead><tr><th>Module</th><th>View</th><th>Create</th><th>Edit</th><th>Delete</th><th>Export</th><th>Approve</th></tr></thead><tbody>
            {data.permissions.map((permission: any) => <tr key={`${permission.role_id}-${permission.module_key}`}><td>{permission.module_key}</td><td>{permission.can_view ? 'Yes' : 'No'}</td><td>{permission.can_create ? 'Yes' : 'No'}</td><td>{permission.can_edit ? 'Yes' : 'No'}</td><td>{permission.can_delete ? 'Yes' : 'No'}</td><td>{permission.can_export ? 'Yes' : 'No'}</td><td>{permission.can_approve ? 'Yes' : 'No'}</td></tr>)}
            {!data.permissions.length && <tr><td colSpan={7}>No inherited permissions found.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {activeTab === 'Activity' && (
        <section className="detail-panel">
          <div className="super-table"><table><thead><tr><th>Action</th><th>Table</th><th>Record</th><th>Time</th></tr></thead><tbody>
            {data.auditLog.map((entry: any) => <tr key={entry.id}><td>{entry.action}</td><td>{entry.table_name}</td><td>{entry.record_id ?? '-'}</td><td>{entry.changed_at ? new Date(entry.changed_at).toLocaleString('en-IN') : '-'}</td></tr>)}
            {!data.auditLog.length && <tr><td colSpan={4}>No activity found.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {activeTab === 'Sessions' && (
        <section className="detail-panel">
          <Button variant="outline" onClick={revokeSessions}>Revoke Sessions</Button>
          <div className="super-table"><table><thead><tr><th>Email</th><th>Created</th><th>Last Sign In</th></tr></thead><tbody>
            {data.sessions.map((session: any) => <tr key={session.id}><td>{session.email}</td><td>{session.created_at ? new Date(session.created_at).toLocaleString('en-IN') : '-'}</td><td>{session.last_sign_in_at ? new Date(session.last_sign_in_at).toLocaleString('en-IN') : '-'}</td></tr>)}
            {!data.sessions.length && <tr><td colSpan={3}>No session metadata found.</td></tr>}
          </tbody></table></div>
        </section>
      )}

      {password && (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-label="New password">
          <button className="modal-shell__backdrop" onClick={() => setPassword('')} aria-label="Close modal" />
          <div className="modal-shell__panel"><div className="modal-shell__header"><h2>New Password</h2><Button variant="ghost" size="sm" onClick={() => setPassword('')}>Close</Button></div><div className="modal-shell__body"><p><strong>{password}</strong></p><Button variant="outline" onClick={() => navigator.clipboard.writeText(password)}>Copy Password</Button></div></div>
        </div>
      )}

      {showDelete && (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Delete user">
          <button className="modal-shell__backdrop" onClick={() => setShowDelete(false)} aria-label="Close modal" />
          <div className="modal-shell__panel"><div className="modal-shell__header"><h2>Delete User</h2><Button variant="ghost" size="sm" onClick={() => setShowDelete(false)}>Close</Button></div><div className="modal-shell__body"><p>Type <strong>{data.user.email}</strong> to permanently delete this user.</p><Input label="Confirmation" value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} /><Button variant="danger" loading={isPending} onClick={deleteUser}>Delete User</Button></div></div>
        </div>
      )}
    </div>
  )
}
