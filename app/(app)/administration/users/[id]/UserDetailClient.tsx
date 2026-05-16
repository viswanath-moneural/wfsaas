'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminUsers } from '@/app/actions/admin'

const PERMISSION_KEYS = ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_export', 'can_approve'] as const

function nameFor(user: any): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
}

function initialsFor(user: any): string {
  return nameFor(user).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function UserDetailClient({ initialData }: { initialData: any }) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<'details' | 'access' | 'permissions' | 'activity'>('details')
  const [edit, setEdit] = useState({
    first_name: initialData.user.first_name ?? '',
    last_name: initialData.user.last_name ?? '',
    email: initialData.user.email ?? '',
    phone: initialData.user.phone ?? '',
    designation: initialData.user.designation ?? '',
    department: initialData.user.department ?? '',
    business_unit_id: initialData.user.business_unit_id ?? '',
    role_id: initialData.user.role_id ?? '',
    profile_id: initialData.user.profile_id ?? '',
    is_active: initialData.user.is_active !== false,
    password_reset_required: initialData.user.password_reset_required !== false,
  })
  const [businessUnitToAdd, setBusinessUnitToAdd] = useState('')
  const [permissionSetToAdd, setPermissionSetToAdd] = useState('')
  const [passwordModal, setPasswordModal] = useState<{ password?: string; email: string } | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()

  const user = data.user
  const lookups = data.lookups ?? {}
  const scopedBusinessUnits = (lookups.businessUnits ?? []).filter((businessUnit: any) => !user.org_id || businessUnit.org_id === user.org_id)
  const scopedRoles = (lookups.roles ?? []).filter((role: any) => role.org_id === user.org_id || role.org_id === null)
  const scopedProfiles = (lookups.profiles ?? []).filter((profile: any) => profile.org_id === user.org_id || profile.org_id === null)
  const assignedSetIds = useMemo(() => new Set((data.assignedPermissionSets ?? []).map((entry: any) => entry.permission_set_id)), [data.assignedPermissionSets])
  const availablePermissionSets = (lookups.permissionSets ?? []).filter((set: any) => set.org_id === user.org_id && !assignedSetIds.has(set.id))

  function refresh() {
    startTransition(async () => {
      const result = await adminUsers.getDetail(user.id)
      if (result.error || !result.data) setError(result.error ?? 'Refresh failed.')
      else setData(result.data)
    })
  }

  function saveDetails() {
    setError('')
    setSuccess('')
    startTransition(async () => {
      const result = await adminUsers.update(user.id, {
        ...edit,
        business_unit_id: edit.business_unit_id || null,
        role_id: edit.role_id || null,
        profile_id: edit.profile_id || null,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess('User details saved.')
      refresh()
    })
  }

  function resetPassword() {
    setPasswordModal({ email: user.email })
  }

  function generatePassword() {
    startTransition(async () => {
      const result = await adminUsers.resetPassword(user.id)
      if (result.error || !result.data) {
        setError(result.error ?? 'Password reset failed.')
        return
      }
      setPasswordModal({ email: user.email, password: result.data.temporaryPassword })
      refresh()
    })
  }

  function toggleStatus() {
    startTransition(async () => {
      const result = user.is_active === false ? await adminUsers.activate(user.id) : await adminUsers.suspend(user.id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function deleteUser() {
    if (!window.confirm(`Delete ${user.email}? This removes the Auth user too.`)) return
    startTransition(async () => {
      const result = await adminUsers.deleteUser(user.id)
      if (result.error) setError(result.error)
      else router.push('/administration/users')
    })
  }

  function addBusinessUnitAccess() {
    if (!businessUnitToAdd) return
    startTransition(async () => {
      const result = await adminUsers.addBusinessUnitAccess(user.id, businessUnitToAdd)
      if (result.error) setError(result.error)
      else {
        setBusinessUnitToAdd('')
        refresh()
      }
    })
  }

  function removeBusinessUnitAccess(businessUnitId: string) {
    startTransition(async () => {
      const result = await adminUsers.removeBusinessUnitAccess(user.id, businessUnitId)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function setDefaultBusinessUnit(businessUnitId: string) {
    startTransition(async () => {
      const result = await adminUsers.setDefaultBusinessUnit(user.id, businessUnitId)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function assignPermissionSet() {
    if (!permissionSetToAdd) return
    startTransition(async () => {
      const result = await adminUsers.assignPermissionSet(user.id, permissionSetToAdd)
      if (result.error) setError(result.error)
      else {
        setPermissionSetToAdd('')
        refresh()
      }
    })
  }

  function removePermissionSet(permissionSetId: string) {
    startTransition(async () => {
      const result = await adminUsers.removePermissionSet(user.id, permissionSetId)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  return (
    <div className="admin-user-detail">
      <div className="admin-detail-header">
        <span className="avatar">{initialsFor(user)}</span>
        <div>
          <h1>{nameFor(user)}</h1>
          <div className="badge-row">
            <Badge variant={user.is_active === false ? 'danger' : 'success'}>{user.is_active === false ? 'Inactive' : 'Active'}</Badge>
            <Badge variant="primary">{user.role?.label ?? 'No role'}</Badge>
            <Badge variant="purple">{user.profile?.label ?? 'No profile'}</Badge>
          </div>
        </div>
        <div className="admin-detail-actions">
          <Button variant="outline" onClick={() => setTab('details')}>Edit</Button>
          <Button variant="outline" onClick={resetPassword}>Reset Password</Button>
          <Button variant="outline" onClick={toggleStatus}>{user.is_active === false ? 'Activate' : 'Suspend'}</Button>
          <Button variant="danger" onClick={deleteUser}>Delete</Button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="tab-bar">
        <button className={tab === 'details' ? 'active' : ''} onClick={() => setTab('details')}>Details</button>
        <button className={tab === 'access' ? 'active' : ''} onClick={() => setTab('access')}>Access</button>
        <button className={tab === 'permissions' ? 'active' : ''} onClick={() => setTab('permissions')}>Permissions</button>
        <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>Activity</button>
      </div>

      {tab === 'details' && (
        <section className="detail-panel">
          <div className="form-grid">
            <Input label="First Name" required value={edit.first_name} onChange={(event) => setEdit({ ...edit, first_name: event.target.value })} />
            <Input label="Last Name" value={edit.last_name} onChange={(event) => setEdit({ ...edit, last_name: event.target.value })} />
            <Input label="Email" required type="email" value={edit.email} onChange={(event) => setEdit({ ...edit, email: event.target.value })} />
            <Input label="Phone" value={edit.phone} onChange={(event) => setEdit({ ...edit, phone: event.target.value })} />
            <Input label="Designation" value={edit.designation} onChange={(event) => setEdit({ ...edit, designation: event.target.value })} />
            <Input label="Department" value={edit.department} onChange={(event) => setEdit({ ...edit, department: event.target.value })} />
            <label>BusinessUnit<select value={edit.business_unit_id} onChange={(event) => setEdit({ ...edit, business_unit_id: event.target.value })}><option value="">No default business unit</option>{scopedBusinessUnits.map((businessUnit: any) => <option key={businessUnit.id} value={businessUnit.id}>{businessUnit.name}</option>)}</select></label>
            <label>Role<select value={edit.role_id} onChange={(event) => setEdit({ ...edit, role_id: event.target.value })}><option value="">No role</option>{scopedRoles.map((role: any) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
            <label>Profile<select value={edit.profile_id} onChange={(event) => setEdit({ ...edit, profile_id: event.target.value })}><option value="">No profile</option>{scopedProfiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
            <label className="toggle-row"><input type="checkbox" checked={edit.password_reset_required} onChange={(event) => setEdit({ ...edit, password_reset_required: event.target.checked })} /> Force password reset</label>
            <label className="toggle-row"><input type="checkbox" checked={edit.is_active} onChange={(event) => setEdit({ ...edit, is_active: event.target.checked })} /> Active</label>
          </div>
          <div className="sticky-actions"><Button loading={isPending} onClick={saveDetails}>Save Details</Button></div>
        </section>
      )}

      {tab === 'access' && (
        <section className="detail-panel">
          <div className="inline-form">
            <label>Add Business Unit<select value={businessUnitToAdd} onChange={(event) => setBusinessUnitToAdd(event.target.value)}><option value="">Select business unit</option>{scopedBusinessUnits.map((businessUnit: any) => <option key={businessUnit.id} value={businessUnit.id}>{businessUnit.name}</option>)}</select></label>
            <Button onClick={addBusinessUnitAccess} disabled={!businessUnitToAdd || isPending}>Add Access</Button>
          </div>
          <div className="super-table">
            <table>
              <thead><tr><th>BusinessUnit</th><th>Code</th><th>Default</th><th>Actions</th></tr></thead>
              <tbody>
                {(data.businessUnitAccess ?? []).map((access: any) => (
                  <tr key={access.business_unit_id}>
                    <td>{access.businessUnits?.name ?? access.business_unit_id}</td>
                    <td>{access.businessUnits?.code ?? '-'}</td>
                    <td>{access.is_default ? <Badge variant="success">Default</Badge> : '-'}</td>
                    <td><div className="row-actions"><Button size="xs" variant="outline" disabled={access.is_default} onClick={() => setDefaultBusinessUnit(access.business_unit_id)}>Set Default</Button><Button size="xs" variant="danger" onClick={() => removeBusinessUnitAccess(access.business_unit_id)}>Remove</Button></div></td>
                  </tr>
                ))}
                {!(data.businessUnitAccess ?? []).length && <tr><td colSpan={4}>No businessUnit access assigned.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'permissions' && (
        <section className="detail-panel">
          <h2>Inherited Permissions</h2>
          <div className="permission-matrix">
            <div className="permission-row permission-row--header"><strong>Module</strong>{PERMISSION_KEYS.map((key) => <strong key={key}>{key.replace('can_', '')}</strong>)}</div>
            {(data.permissions ?? []).map((permission: any) => (
              <div className="permission-row readonly" key={permission.module_key}>
                <strong>{permission.module_key}</strong>
                {PERMISSION_KEYS.map((key) => <span key={key}>{permission[key] ? 'Yes' : 'No'}</span>)}
              </div>
            ))}
            {!(data.permissions ?? []).length && <p>No profile or permission set permissions assigned.</p>}
          </div>

          <h2>Permission Sets</h2>
          <div className="inline-form">
            <label>Assign Permission Set<select value={permissionSetToAdd} onChange={(event) => setPermissionSetToAdd(event.target.value)}><option value="">Select permission set</option>{availablePermissionSets.map((set: any) => <option key={set.id} value={set.id}>{set.label}</option>)}</select></label>
            <Button onClick={assignPermissionSet} disabled={!permissionSetToAdd || isPending}>Assign</Button>
          </div>
          <div className="super-table">
            <table>
              <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
              <tbody>
                {(data.assignedPermissionSets ?? []).map((assignment: any) => (
                  <tr key={assignment.id}>
                    <td>{assignment.permission_sets?.label ?? assignment.permission_set_id}</td>
                    <td>{assignment.permission_sets?.description ?? '-'}</td>
                    <td><Button size="xs" variant="danger" onClick={() => removePermissionSet(assignment.permission_set_id)}>Remove</Button></td>
                  </tr>
                ))}
                {!(data.assignedPermissionSets ?? []).length && <tr><td colSpan={3}>No permission sets assigned.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'activity' && (
        <section className="detail-panel">
          <div className="super-table">
            <table>
              <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Entity</th><th>Status</th></tr></thead>
              <tbody>
                {(data.auditLog ?? []).map((entry: any) => (
                  <tr key={entry.id}>
                    <td>{entry.created_at ? new Date(entry.created_at).toLocaleString('en-IN') : '-'}</td>
                    <td>{entry.actor_email ?? entry.actor_id ?? '-'}</td>
                    <td>{entry.action}</td>
                    <td>{entry.entity_name ?? entry.entity_type}</td>
                    <td><Badge variant={entry.status === 'failed' ? 'danger' : 'success'}>{entry.status ?? 'success'}</Badge></td>
                  </tr>
                ))}
                {!(data.auditLog ?? []).length && <tr><td colSpan={5}>No recent activity.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {passwordModal && (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Reset password">
          <button className="modal-shell__backdrop" onClick={() => setPasswordModal(null)} aria-label="Close modal" />
          <div className="modal-shell__panel">
            <div className="modal-shell__header"><h2>Reset Password</h2><Button size="sm" variant="ghost" onClick={() => setPasswordModal(null)}>Close</Button></div>
            <div className="modal-shell__body">
              <p>{passwordModal.email}</p>
              {passwordModal.password ? <p>New password: <strong>{passwordModal.password}</strong></p> : <p>Generate a new temporary password for this user.</p>}
              <div className="row-actions">
                <Button loading={isPending} onClick={generatePassword}>Generate</Button>
                {passwordModal.password && <Button variant="outline" onClick={() => navigator.clipboard.writeText(passwordModal.password ?? '')}>Copy Password</Button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}













