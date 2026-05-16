'use client'

import { useMemo, useState, useTransition } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { superadminPermissions, superadminRoles } from '@/app/actions/superadmin'

const actions = [
  ['can_view', 'View'],
  ['can_create', 'Create'],
  ['can_edit', 'Edit'],
  ['can_delete', 'Delete'],
  ['can_export', 'Export'],
  ['can_approve', 'Approve'],
] as const

const groups = [
  { key: 'core', label: 'Core Platform', modules: ['dashboard', 'configuration', 'reports'] },
  { key: 'operations', label: 'Operations', modules: ['sales', 'purchases', 'inventory', 'manufacturing'] },
  { key: 'people', label: 'People & Growth', modules: ['crm', 'hr'] },
]

export default function RoleDetailClient({ initialData }: { initialData: any }) {
  const [role, setRole] = useState(initialData.role)
  const [permissions, setPermissions] = useState(initialData.permissions)
  const [savedPermissions, setSavedPermissions] = useState(initialData.permissions)
  const [editingName, setEditingName] = useState(false)
  const [roleName, setRoleName] = useState(initialData.role.role_name)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ core: true, operations: true, people: true })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const permissionByModule = useMemo(() => new Map(permissions.map((permission: any) => [permission.module_key, permission])), [permissions])
  const savedByModule = useMemo(() => new Map(savedPermissions.map((permission: any) => [permission.module_key, permission])), [savedPermissions])
  const allOn = permissions.every((permission: any) => actions.every(([key]) => permission[key]))

  function changed(moduleKey: string, actionKey: string) {
    return Boolean((permissionByModule.get(moduleKey) as any)?.[actionKey]) !== Boolean((savedByModule.get(moduleKey) as any)?.[actionKey])
  }

  function setCell(moduleKey: string, actionKey: string, value: boolean) {
    setPermissions((current: any[]) => current.map((permission) => (
      permission.module_key === moduleKey ? { ...permission, [actionKey]: value } : permission
    )))
  }

  function selectAll(value: boolean) {
    setPermissions((current: any[]) => current.map((permission) => {
      const next = { ...permission }
      actions.forEach(([key]) => { next[key] = value })
      return next
    }))
  }

  function savePermissions() {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await superadminPermissions.bulkUpdate(role.id, permissions)
      if (result.error || !result.data) {
        setError(result.error ?? 'Failed to save permissions.')
        return
      }
      setSavedPermissions(result.data)
      setPermissions(result.data)
      setMessage('Permissions saved.')
    })
  }

  function saveName() {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await superadminRoles.update(role.id, { role_name: roleName })
      if (result.error || !result.data) {
        setError(result.error ?? 'Failed to update role.')
        return
      }
      setRole(result.data)
      setEditingName(false)
      setMessage('Role updated.')
    })
  }

  return (
    <div className="role-detail">
      <div className="org-detail__header">
        <div>
          {editingName ? (
            <div className="inline-form">
              <Input label="Role Name" value={roleName} onChange={(event) => setRoleName(event.target.value)} />
              <Button loading={isPending} onClick={saveName}>Save</Button>
            </div>
          ) : (
            <>
              <h1>{role.role_name}</h1>
              <Badge variant={role.is_system ? 'slate' : 'info'}>{role.is_system ? 'System' : 'Custom'}</Badge>
            </>
          )}
        </div>
        <Button variant="outline" disabled={role.is_system} onClick={() => setEditingName(true)}>Edit Name</Button>
      </div>
      {message && <div className="success-banner">{message}</div>}
      {error && <div className="form-error">{error}</div>}

      <div className="permission-matrix">
        <div className="permission-row permission-row--header">
          <strong>Select All</strong>
          {actions.map(([key, label]) => (
            <label key={key}><span>{label}</span><input type="checkbox" checked={allOn} onChange={(event) => selectAll(event.target.checked)} /></label>
          ))}
        </div>

        {groups.map((group) => (
          <div key={group.key} className="permission-group">
            <button className="permission-group__header" onClick={() => setExpanded((current) => ({ ...current, [group.key]: !current[group.key] }))}>
              {expanded[group.key] ? 'Down' : 'Right'} {group.label}
            </button>
            {expanded[group.key] && group.modules.map((moduleKey) => {
              const permission = permissionByModule.get(moduleKey) as any
              if (!permission) return null
              return (
                <div key={moduleKey} className="permission-row">
                  <strong>{moduleKey}</strong>
                  {actions.map(([key, label]) => (
                    <label key={key} className={changed(moduleKey, key) ? 'unsaved' : ''}>
                      <span>{label}</span>
                      <input type="checkbox" checked={Boolean(permission[key])} onChange={(event) => setCell(moduleKey, key, event.target.checked)} />
                    </label>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="sticky-actions">
        <Button loading={isPending} onClick={savePermissions}>Save Permissions</Button>
      </div>
    </div>
  )
}
