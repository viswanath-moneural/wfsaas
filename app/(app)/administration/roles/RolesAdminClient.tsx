'use client'

import { useMemo, useState, useTransition } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminRoles } from '@/app/actions/admin'

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function buildTree(roles: any[]) {
  const byParent = new Map<string, any[]>()
  roles.forEach((role) => {
    const key = role.parent_role_id ?? 'root'
    byParent.set(key, [...(byParent.get(key) ?? []), role])
  })
  byParent.forEach((items) => items.sort((a, b) => String(a.label).localeCompare(String(b.label))))
  const rows: Array<any & { depth: number }> = []
  const visit = (parentId: string, depth: number) => {
    ;(byParent.get(parentId) ?? []).forEach((role) => {
      rows.push({ ...role, depth })
      visit(role.id, depth + 1)
    })
  }
  visit('root', 0)
  return rows
}

export default function RolesAdminClient({ initialRoles, userCounts, lookups }: { initialRoles: any[]; userCounts: Record<string, number>; lookups: any }) {
  const [roles, setRoles] = useState(initialRoles)
  const [counts, setCounts] = useState(userCounts)
  const [treeView, setTreeView] = useState(false)
  const [panel, setPanel] = useState<{ mode: 'create' | 'edit'; role?: any } | null>(null)
  const [form, setForm] = useState({
    label: '',
    name: '',
    description: '',
    parent_role_id: '',
    org_id: lookups.currentUser?.org_id ?? '',
    is_system: false,
  })
  const [dragRoleId, setDragRoleId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()
  const isSuperadmin = lookups.currentUser?.is_superadmin === true

  const treeRows = useMemo(() => buildTree(roles), [roles])
  const roleOptions = roles.filter((role) => role.id !== form.parent_role_id && (!form.org_id || role.org_id === form.org_id || role.org_id === null))

  function refresh() {
    startTransition(async () => {
      const [rolesResult, lookupsResult] = await Promise.all([adminRoles.getAll(), adminRoles.getLookups()])
      if (rolesResult.data) setRoles(rolesResult.data)
      if (lookupsResult.data?.users) {
        const nextCounts = lookupsResult.data.users.reduce((acc: Record<string, number>, user: any) => {
          if (user.role_id) acc[user.role_id] = (acc[user.role_id] ?? 0) + 1
          return acc
        }, {})
        setCounts(nextCounts)
      }
    })
  }

  function openCreate() {
    setError('')
    setPanel({ mode: 'create' })
    setForm({ label: '', name: '', description: '', parent_role_id: '', org_id: lookups.currentUser?.org_id ?? '', is_system: false })
  }

  function openEdit(role: any) {
    setError('')
    setPanel({ mode: 'edit', role })
    setForm({
      label: role.label ?? '',
      name: role.name ?? '',
      description: role.description ?? '',
      parent_role_id: role.parent_role_id ?? '',
      org_id: role.org_id ?? '',
      is_system: role.is_system === true,
    })
  }

  function submit() {
    if (!panel) return
    setError('')
    setSuccess('')
    startTransition(async () => {
      const label = form.label.trim()
      if (!label) {
        setError('Role label is required.')
        return
      }

      const payload = {
        org_id: form.org_id || null,
        label,
        name: form.name || slugify(label),
        description: form.description || null,
        parent_role_id: form.parent_role_id || null,
        is_system: form.is_system,
      }
      const result = panel.mode === 'edit'
        ? await adminRoles.update(panel.role.id, panel.role.is_system ? { ...payload, name: panel.role.name, is_system: panel.role.is_system } : payload)
        : await adminRoles.create(payload)

      if (result.error) {
        setError(result.error)
        return
      }
      setPanel(null)
      setSuccess(panel.mode === 'edit' ? 'Role updated.' : 'Role created.')
      refresh()
    })
  }

  function deleteRole(role: any) {
    if (role.is_system || (counts[role.id] ?? 0) > 0) return
    if (!window.confirm(`Delete role ${role.label}?`)) return
    startTransition(async () => {
      const result = await adminRoles.delete(role.id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function setParent(roleId: string, parentRoleId: string | null) {
    if (roleId === parentRoleId) return
    const moving = roles.find((role) => role.id === roleId)
    if (!moving) return
    startTransition(async () => {
      const result = await adminRoles.update(roleId, { parent_role_id: parentRoleId })
      if (result.error) setError(result.error)
      else {
        setSuccess(`Moved ${moving.label}.`)
        refresh()
      }
    })
  }

  return (
    <div className="admin-roles-page">
      <div className="admin-page-header">
        <div>
          <h1>Roles</h1>
          <p>Manage role hierarchy, parent roles, and organisation access structure.</p>
        </div>
        <div className="row-actions">
          <Button variant="outline" onClick={() => setTreeView((current) => !current)}>{treeView ? 'Table View' : 'Tree View'}</Button>
          <Button onClick={openCreate}>New Role</Button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className={treeView ? 'role-tree super-table' : 'super-table'}>
        <table>
          <thead><tr><th>Role Name</th><th>Label</th><th>Type</th><th>Parent Role</th><th>Users Count</th><th>Actions</th></tr></thead>
          <tbody>
            {treeRows.map((role) => {
              const parent = roles.find((item) => item.id === role.parent_role_id)
              const assigned = counts[role.id] ?? 0
              return (
                <tr
                  key={role.id}
                  draggable={treeView}
                  onDragStart={() => setDragRoleId(role.id)}
                  onDragOver={(event) => treeView && event.preventDefault()}
                  onDrop={() => {
                    if (treeView && dragRoleId) setParent(dragRoleId, role.id)
                    setDragRoleId('')
                  }}
                >
                  <td><span className="hierarchy-cell" style={{ paddingLeft: role.depth * 22 }}>{role.is_system ? 'Lock ' : ''}{role.name}</span></td>
                  <td>{role.label}</td>
                  <td><Badge variant={role.is_system ? 'slate' : 'primary'}>{role.is_system ? 'System' : 'Custom'}</Badge></td>
                  <td>{parent?.label ?? '-'}</td>
                  <td>{assigned}</td>
                  <td>
                    <div className="row-actions">
                      <Button size="xs" variant="outline" onClick={() => openEdit(role)}>Edit</Button>
                      {treeView && <Button size="xs" variant="ghost" onClick={() => setParent(role.id, null)}>Move Root</Button>}
                      <Button size="xs" variant="danger" disabled={role.is_system || assigned > 0} onClick={() => deleteRole(role)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!treeRows.length && <tr><td colSpan={6}>No roles found.</td></tr>}
          </tbody>
        </table>
      </div>

      {treeView && <p className="admin-help-text">Drag a role row onto another role to make it a child. Use Move Root to remove its parent.</p>}

      {panel && (
        <div className="slide-over" role="dialog" aria-modal="true" aria-label="Role form">
          <button className="slide-over__backdrop" onClick={() => setPanel(null)} aria-label="Close panel" />
          <div className="slide-over__panel">
            <div className="slide-over__header"><h2>{panel.mode === 'edit' ? 'Edit Role' : 'New Role'}</h2><Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Close</Button></div>
            <div className="slide-over__body">
              <Input label="Label" required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value, name: panel.mode === 'edit' && panel.role?.is_system ? form.name : slugify(event.target.value) })} />
              <Input label="Name" required value={form.name} disabled={panel.mode === 'edit' && panel.role?.is_system} onChange={(event) => setForm({ ...form, name: slugify(event.target.value) })} helper={panel.mode === 'edit' && panel.role?.is_system ? 'System role names cannot be changed.' : undefined} />
              <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              {isSuperadmin && <label>Organisation<select value={form.org_id} onChange={(event) => setForm({ ...form, org_id: event.target.value, parent_role_id: '' })}><option value="">System/global</option>{(lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
              <label>Parent Role<select value={form.parent_role_id} onChange={(event) => setForm({ ...form, parent_role_id: event.target.value })}><option value="">No parent</option>{roleOptions.filter((role) => role.id !== panel.role?.id).map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
              <label>Type<select value={form.is_system ? 'system' : 'custom'} disabled={panel.mode === 'edit' && panel.role?.is_system} onChange={(event) => setForm({ ...form, is_system: event.target.value === 'system' })}><option value="custom">Custom</option>{isSuperadmin && <option value="system">System</option>}</select></label>
            </div>
            <div className="slide-over__footer"><Button variant="outline" onClick={() => setPanel(null)}>Cancel</Button><Button loading={isPending} onClick={submit}>Save</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}





