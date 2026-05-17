'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import { Dialog, DialogCancel, DialogContent, DialogFooter } from '@/components/ui/Dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableStyles } from '@/components/ui/Table'
import { cloneRole, createRole, deleteRole, updateRole } from '@/app/actions/systemSetup/roles'

function roleName(role: any) {
  return role.role_name ?? role.name ?? role.label ?? 'Untitled role'
}

function roleLabel(role: any) {
  return role.label ?? role.role_name ?? role.name ?? 'Untitled role'
}

export default function RolesManagerClient({ initialRoles, userCounts }: { initialRoles: any[]; userCounts: Record<string, number> }) {
  const router = useRouter()
  const [roles, setRoles] = useState(initialRoles)
  const [counts] = useState(userCounts)
  const [panel, setPanel] = useState<{ mode: 'create' | 'edit' | 'clone'; role?: any } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [form, setForm] = useState({ role_name: '', description: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const sortedRoles = useMemo(() => [...roles].sort((a, b) => roleLabel(a).localeCompare(roleLabel(b))), [roles])

  function openCreate() {
    setError('')
    setPanel({ mode: 'create' })
    setForm({ role_name: '', description: '' })
  }

  function openEdit(role: any) {
    setError('')
    setPanel({ mode: 'edit', role })
    setForm({ role_name: roleLabel(role), description: role.description ?? '' })
  }

  function openClone(role: any) {
    setError('')
    setPanel({ mode: 'clone', role })
    setForm({ role_name: `Copy of ${roleLabel(role)}`, description: role.description ?? '' })
  }

  function submitPanel() {
    if (!panel) return
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = panel.mode === 'create'
        ? await createRole(form)
        : panel.mode === 'clone'
          ? await cloneRole(panel.role.id, form.role_name)
          : await updateRole(panel.role.id, form)

      if (result.error || !result.data) {
        setError(result.error ?? 'Role save failed.')
        return
      }

      setPanel(null)
      if (panel.mode === 'create' || panel.mode === 'clone') {
        router.push(`/system-setup/roles/${result.data.id}`)
        return
      }
      setRoles((current) => current.map((role) => role.id === result.data.id ? result.data : role))
      setMessage('Role updated.')
    })
  }

  function confirmDelete() {
    if (!deleteTarget) return
    setError('')
    startTransition(async () => {
      const result = await deleteRole(deleteTarget.id)
      if (result.error) {
        setError(result.error)
        setDeleteTarget(null)
        return
      }
      setRoles((current) => current.filter((role) => role.id !== deleteTarget.id))
      setDeleteTarget(null)
      setMessage('Role deleted.')
    })
  }

  return (
    <div className="setup-roles">
      <div className="setup-page-header">
        <div>
          <h1>Roles & Permissions</h1>
          <p>Create roles, clone access patterns, and manage module and field-level security.</p>
        </div>
        <Button onClick={openCreate}>Create New Role</Button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <div className="setup-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>User Count</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRoles.map((role) => {
              const assigned = counts[role.id] ?? 0
              return (
                <TableRow key={role.id}>
                  <TableCell><strong>{roleLabel(role)}</strong><br /><small>{roleName(role)}</small></TableCell>
                  <TableCell>{role.description ?? '-'}</TableCell>
                  <TableCell><Badge variant={role.is_system ? 'slate' : 'primary'}>{role.is_system ? 'System' : 'Custom'}</Badge></TableCell>
                  <TableCell>{assigned}</TableCell>
                  <TableCell>
                    <div className="row-actions">
                      <Button size="xs" variant="outline" onClick={() => router.push(`/system-setup/roles/${role.id}`)}>View</Button>
                      {!role.is_system && <Button size="xs" variant="outline" onClick={() => openEdit(role)}>Edit</Button>}
                      <Button size="xs" variant="outline" onClick={() => openClone(role)}>Clone</Button>
                      {!role.is_system && <Button size="xs" variant="danger" disabled={assigned > 0} onClick={() => setDeleteTarget(role)}>Delete</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {!sortedRoles.length && <TableRow><TableCell colSpan={5}>No roles found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {panel && (
        <div className="slide-over" role="dialog" aria-modal="true" aria-label="Role form">
          <button className="slide-over__backdrop" onClick={() => setPanel(null)} aria-label="Close role form" />
          <div className="slide-over__panel">
            <div className="slide-over__header">
              <h2>{panel.mode === 'create' ? 'Create Role' : panel.mode === 'clone' ? 'Clone Role' : 'Edit Role'}</h2>
              <Button size="sm" variant="ghost" onClick={() => setPanel(null)}>Close</Button>
            </div>
            <div className="slide-over__body">
              <Input label="Role Name" value={form.role_name} disabled={panel.mode === 'edit' && panel.role?.is_system} onChange={(event) => setForm({ ...form, role_name: event.target.value })} required />
              <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            </div>
            <div className="slide-over__footer">
              <Button variant="outline" onClick={() => setPanel(null)}>Cancel</Button>
              <Button loading={isPending} onClick={submitPanel}>{panel.mode === 'clone' ? 'Clone' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={Boolean(deleteTarget)}>
        <DialogContent title="Delete role?" description="This cannot be undone. Roles assigned to users cannot be deleted." onClose={() => setDeleteTarget(null)}>
          <p><strong>{deleteTarget ? roleLabel(deleteTarget) : ''}</strong></p>
          <DialogFooter>
            <DialogCancel onClick={() => setDeleteTarget(null)} />
            <Button variant="danger" loading={isPending} onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TableStyles />
      <style jsx>{`
        .setup-page-header {
          display: flex;
          justify-content: space-between;
          gap: var(--space-4);
          margin-bottom: var(--space-5);
        }
        .setup-page-header h1 {
          margin: 0;
          font-size: var(--text-2xl);
        }
        .setup-page-header p {
          margin: var(--space-1) 0 0;
          color: var(--text-secondary);
        }
        .setup-card {
          overflow: hidden;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--surface-card);
        }
        small {
          color: var(--text-secondary);
        }
        .row-actions {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }
        textarea {
          min-height: 90px;
          width: 100%;
          padding: var(--space-3);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          font: inherit;
        }
      `}</style>
    </div>
  )
}
