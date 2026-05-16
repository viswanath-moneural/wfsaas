'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { adminProfiles } from '@/app/actions/admin'

const PERMISSION_COLUMNS = [
  { key: 'can_view', label: 'View' },
  { key: 'can_create', label: 'Create' },
  { key: 'can_edit', label: 'Edit' },
  { key: 'can_delete', label: 'Delete' },
  { key: 'can_export', label: 'Export' },
  { key: 'can_approve', label: 'Approve' },
] as const

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

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export default function ProfileDetailClient({ initialData }: { initialData: any }) {
  const router = useRouter()
  const [profile, setProfile] = useState(initialData.profile)
  const [permissions, setPermissions] = useState(() => buildPermissionRows(initialData.lookups.modules ?? [], initialData.permissions ?? []))
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(permissions))
  const [editingName, setEditingName] = useState(false)
  const [nameForm, setNameForm] = useState({ label: profile.label ?? '', name: profile.name ?? '', description: profile.description ?? '' })
  const [cloneModal, setCloneModal] = useState(false)
  const [cloneName, setCloneName] = useState(`Copy of ${profile.label}`)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()

  const hasUnsaved = JSON.stringify(permissions) !== savedSnapshot
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    permissions.forEach((row: any) => {
      const group = groupFor(row.module_key)
      groups[group] = groups[group] ?? []
      groups[group].push(row)
    })
    return groups
  }, [permissions])

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
      const payload = permissions.map(({ module_id, can_view, can_create, can_edit, can_delete, can_export, can_approve }: any) => ({
        module_id,
        can_view,
        can_create,
        can_edit,
        can_delete,
        can_export,
        can_approve,
      }))
      const result = await adminProfiles.updatePermissions(profile.id, payload)
      if (result.error) {
        setError(result.error)
        return
      }
      setSavedSnapshot(JSON.stringify(permissions))
      setSuccess('Permissions saved.')
    })
  }

  function saveName() {
    startTransition(async () => {
      const result = await adminProfiles.update(profile.id, {
        label: nameForm.label,
        name: nameForm.name || slugify(nameForm.label),
        description: nameForm.description || null,
      })
      if (result.error || !result.data) setError(result.error ?? 'Profile update failed.')
      else {
        setProfile(result.data)
        setEditingName(false)
        setSuccess('Profile updated.')
      }
    })
  }

  function cloneProfile() {
    startTransition(async () => {
      const result = await adminProfiles.clone(profile.id, cloneName)
      if (result.error || !result.data) {
        setError(result.error ?? 'Clone failed.')
        return
      }
      router.push(`/administration/profiles/${result.data.id}`)
    })
  }

  function deleteProfile() {
    if (profile.is_system) return
    if (!window.confirm(`Delete profile ${profile.label}?`)) return
    startTransition(async () => {
      const result = await adminProfiles.delete(profile.id)
      if (result.error) setError(result.error)
      else router.push('/administration/profiles')
    })
  }

  return (
    <div className="admin-profile-detail">
      <div className="admin-detail-header">
        <div>
          <h1>{profile.label}</h1>
          <div className="badge-row">
            <Badge variant={profile.is_system ? 'slate' : 'primary'}>{profile.is_system ? 'System' : 'Custom'}</Badge>
            <Badge variant="info">{initialData.usersCount ?? 0} users</Badge>
          </div>
        </div>
        <div className="admin-detail-actions">
          <Button variant="outline" onClick={() => setEditingName(true)}>Edit Name</Button>
          <Button variant="outline" onClick={() => setCloneModal(true)}>Clone</Button>
          <Button variant="danger" disabled={profile.is_system} onClick={deleteProfile}>Delete</Button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      {editingName && (
        <section className="detail-panel">
          <div className="form-grid">
            <Input label="Profile Name" value={nameForm.label} onChange={(event) => setNameForm({ ...nameForm, label: event.target.value, name: slugify(event.target.value) })} />
            <Input label="API Name" value={nameForm.name} onChange={(event) => setNameForm({ ...nameForm, name: slugify(event.target.value) })} />
            <label>Description<textarea value={nameForm.description} onChange={(event) => setNameForm({ ...nameForm, description: event.target.value })} /></label>
          </div>
          <div className="row-actions"><Button onClick={saveName} loading={isPending}>Save Profile</Button><Button variant="outline" onClick={() => setEditingName(false)}>Cancel</Button></div>
        </section>
      )}

      <section className="detail-panel profile-permissions-panel">
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
            <thead>
              <tr><th>Module</th>{PERMISSION_COLUMNS.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
            </thead>
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
        <div className="fixed-save-bar"><span>{hasUnsaved ? 'Unsaved permission changes' : 'Permissions are up to date'}</span><Button loading={isPending} disabled={!hasUnsaved} onClick={savePermissions}>Save</Button></div>
      </section>

      {cloneModal && (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Clone profile">
          <button className="modal-shell__backdrop" onClick={() => setCloneModal(false)} aria-label="Close modal" />
          <div className="modal-shell__panel">
            <div className="modal-shell__header"><h2>Clone Profile</h2><Button size="sm" variant="ghost" onClick={() => setCloneModal(false)}>Close</Button></div>
            <div className="modal-shell__body">
              <Input label="New Profile Name" value={cloneName} onChange={(event) => setCloneName(event.target.value)} />
              <Button loading={isPending} onClick={cloneProfile}>Clone Profile</Button>
            </div>
          </div>
        </div>
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





