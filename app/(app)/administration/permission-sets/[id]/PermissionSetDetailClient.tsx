'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminPermissionSets } from '@/app/actions/admin'

const PERMISSION_COLUMNS = [
  { key: 'can_view', label: 'View' },
  { key: 'can_create', label: 'Create' },
  { key: 'can_edit', label: 'Edit' },
  { key: 'can_delete', label: 'Delete' },
  { key: 'can_export', label: 'Export' },
  { key: 'can_approve', label: 'Approve' },
] as const

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function groupFor(moduleKey: string) {
  if (moduleKey.includes('sales')) return 'SALES MODULES'
  if (moduleKey.includes('purchase')) return 'PURCHASE MODULES'
  if (moduleKey.includes('inventory')) return 'INVENTORY MODULES'
  if (moduleKey.includes('crm')) return 'CRM MODULES'
  if (moduleKey.includes('hr')) return 'HR MODULES'
  if (moduleKey.includes('manufacturing')) return 'MANUFACTURING MODULES'
  if (moduleKey.includes('report')) return 'REPORTING MODULES'
  return 'CORE MODULES'
}

function userName(user: any) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
}

export default function PermissionSetDetailClient({ initialData }: { initialData: any }) {
  const router = useRouter()
  const [permissionSet, setPermissionSet] = useState(initialData.permissionSet)
  const [permissions, setPermissions] = useState(() => buildPermissionRows(initialData.lookups.modules ?? [], initialData.permissions ?? []))
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(permissions))
  const [assignedUsers, setAssignedUsers] = useState(initialData.assignedUsers ?? [])
  const [tab, setTab] = useState<'permissions' | 'users'>('permissions')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ label: permissionSet.label ?? '', name: permissionSet.name ?? '', description: permissionSet.description ?? '' })
  const [userToAdd, setUserToAdd] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()
  const hasUnsaved = JSON.stringify(permissions) !== savedSnapshot

  const assignedUserIds = useMemo(() => new Set(assignedUsers.map((entry: any) => entry.user_id)), [assignedUsers])
  const availableUsers = (initialData.lookups.users ?? []).filter((user: any) => user.org_id === permissionSet.org_id && !assignedUserIds.has(user.id))
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    permissions.forEach((row: any) => {
      const group = groupFor(row.module_key)
      groups[group] = groups[group] ?? []
      groups[group].push(row)
    })
    return groups
  }, [permissions])

  function refresh() {
    startTransition(async () => {
      const result = await adminPermissionSets.getDetail(permissionSet.id)
      if (result.error || !result.data) {
        setError(result.error ?? 'Refresh failed.')
        return
      }
      setPermissionSet(result.data.permissionSet)
      setAssignedUsers(result.data.assignedUsers ?? [])
      const rows = buildPermissionRows(result.data.lookups.modules ?? [], result.data.permissions ?? [])
      setPermissions(rows)
      setSavedSnapshot(JSON.stringify(rows))
    })
  }

  function setCell(moduleId: string, key: string, value: boolean) {
    setPermissions((current: any[]) => current.map((row) => row.module_id === moduleId ? { ...row, [key]: value } : row))
  }

  function setColumn(key: string, value: boolean) {
    setPermissions((current: any[]) => current.map((row) => ({ ...row, [key]: value })))
  }

  function savePermissions() {
    setError('')
    setSuccess('')
    startTransition(async () => {
      // Permission sets are additive: these rows only grant capabilities.
      // getEffectivePermissions() unions them with profile permissions using OR logic.
      const payload = permissions.map(({ module_id, can_view, can_create, can_edit, can_delete, can_export, can_approve }: any) => ({
        module_id,
        can_view,
        can_create,
        can_edit,
        can_delete,
        can_export,
        can_approve,
      }))
      const result = await adminPermissionSets.updatePermissions(permissionSet.id, payload)
      if (result.error) {
        setError(result.error)
        return
      }
      setSavedSnapshot(JSON.stringify(permissions))
      setSuccess('Permission set grants saved.')
    })
  }

  function saveDetails() {
    startTransition(async () => {
      const result = await adminPermissionSets.update(permissionSet.id, {
        label: form.label,
        name: form.name || slugify(form.label),
        description: form.description || null,
      })
      if (result.error || !result.data) {
        setError(result.error ?? 'Update failed.')
        return
      }
      setPermissionSet(result.data)
      setEditing(false)
      setSuccess('Permission set updated.')
    })
  }

  function deleteSet() {
    if (!window.confirm(`Delete permission set ${permissionSet.label}?`)) return
    startTransition(async () => {
      const result = await adminPermissionSets.delete(permissionSet.id)
      if (result.error) setError(result.error)
      else router.push('/administration/permission-sets')
    })
  }

  function assignUser() {
    if (!userToAdd) return
    startTransition(async () => {
      const result = await adminPermissionSets.assignUser(permissionSet.id, userToAdd)
      if (result.error) setError(result.error)
      else {
        setUserToAdd('')
        refresh()
      }
    })
  }

  function removeUser(userId: string) {
    startTransition(async () => {
      const result = await adminPermissionSets.removeUser(permissionSet.id, userId)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  return (
    <div className="admin-permission-set-detail">
      <div className="admin-detail-header">
        <div>
          <h1>{permissionSet.label}</h1>
          <div className="badge-row">
            <Badge variant="primary">Permission Set</Badge>
            <Badge variant="info">{assignedUsers.length} users assigned</Badge>
          </div>
        </div>
        <div className="admin-detail-actions">
          <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="danger" onClick={deleteSet}>Delete</Button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {editing && (
        <section className="detail-panel">
          <div className="form-grid">
            <Input label="Name" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value, name: slugify(event.target.value) })} />
            <Input label="API Name" value={form.name} onChange={(event) => setForm({ ...form, name: slugify(event.target.value) })} />
            <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          </div>
          <div className="row-actions"><Button loading={isPending} onClick={saveDetails}>Save</Button><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button></div>
        </section>
      )}

      <div className="tab-bar">
        <button className={tab === 'permissions' ? 'active' : ''} onClick={() => setTab('permissions')}>Permissions</button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Assigned Users</button>
      </div>

      {tab === 'permissions' && (
        <section className="detail-panel profile-permissions-panel">
          <div className="success-box">
            <strong>Additive access</strong>
            <span>A user's effective permissions = Profile permissions UNION Permission Set permissions. Permission sets can only grant more access; they do not remove permissions granted by the profile.</span>
          </div>
          <div className="permission-tools">
            {PERMISSION_COLUMNS.map((column) => (
              <div key={column.key}>
                <strong>{column.label}</strong>
                <Button size="xs" variant="outline" onClick={() => setColumn(column.key, true)}>Enable All</Button>
                <Button size="xs" variant="ghost" onClick={() => setColumn(column.key, false)}>Disable All</Button>
              </div>
            ))}
          </div>
          <div className="profile-permission-table">
            <table>
              <thead><tr><th>Module</th>{PERMISSION_COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
              <tbody>
                {Object.entries(grouped).map(([group, rows]) => (
                  <Fragment key={group}>
                    <tr className="permission-group-row"><td colSpan={7}>{group}</td></tr>
                    {(rows as any[]).map((row) => (
                      <tr key={row.module_id}>
                        <th>{row.module_label}</th>
                        {PERMISSION_COLUMNS.map((column) => {
                          const changed = row[column.key] !== row.original[column.key]
                          return (
                            <td key={column.key} className={changed ? 'unsaved-cell' : ''}>
                              <label className="tick-checkbox">
                                <input type="checkbox" checked={Boolean(row[column.key])} onChange={(event) => setCell(row.module_id, column.key, event.target.checked)} />
                                <span>{row[column.key] ? '✓' : ''}</span>
                              </label>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fixed-save-bar"><span>{hasUnsaved ? 'Unsaved permission grants' : 'Permission grants are up to date'}</span><Button loading={isPending} disabled={!hasUnsaved} onClick={savePermissions}>Save</Button></div>
        </section>
      )}

      {tab === 'users' && (
        <section className="detail-panel">
          <div className="inline-form">
            <label>Add User<select value={userToAdd} onChange={(event) => setUserToAdd(event.target.value)}><option value="">Select user</option>{availableUsers.map((user: any) => <option key={user.id} value={user.id}>{userName(user)} - {user.email}</option>)}</select></label>
            <Button disabled={!userToAdd || isPending} onClick={assignUser}>Assign</Button>
          </div>
          <div className="super-table">
            <table>
              <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Profile</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {assignedUsers.map((assignment: any) => (
                  <tr key={assignment.id}>
                    <td>{userName(assignment.users)}</td>
                    <td>{assignment.users?.email ?? '-'}</td>
                    <td>{assignment.users?.role?.label ?? '-'}</td>
                    <td>{assignment.users?.profile?.label ?? '-'}</td>
                    <td><Badge variant={assignment.users?.is_active === false ? 'danger' : 'success'}>{assignment.users?.is_active === false ? 'Inactive' : 'Active'}</Badge></td>
                    <td><Button size="xs" variant="danger" onClick={() => removeUser(assignment.user_id)}>Remove</Button></td>
                  </tr>
                ))}
                {!assignedUsers.length && <tr><td colSpan={6}>No users assigned.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function buildPermissionRows(modules: any[], permissions: any[]) {
  return modules.map((moduleRow) => {
    const permission = permissions.find((row) => row.module_id === moduleRow.id) ?? {}
    const base = {
      module_id: moduleRow.id,
      module_key: moduleRow.key,
      module_label: moduleRow.label,
      can_view: Boolean(permission.can_view),
      can_create: Boolean(permission.can_create),
      can_edit: Boolean(permission.can_edit),
      can_delete: Boolean(permission.can_delete),
      can_export: Boolean(permission.can_export),
      can_approve: Boolean(permission.can_approve),
    }
    return { ...base, original: { ...base } }
  })
}
