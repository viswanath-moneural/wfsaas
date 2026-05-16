'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { superadminUsers } from '@/app/actions/superadmin'

const PAGE_SIZE = 25

function fullName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

export default function UsersClient({ users, lookups }: { users: any[]; lookups: any }) {
  const [rows, setRows] = useState(users)
  const [query, setQuery] = useState('')
  const [orgId, setOrgId] = useState('all')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    temporaryPassword: '',
    org_id: '',
    tenant_id: '',
    role_id: '',
    phone: '',
    is_active: true,
  })

  const orgFactories = (lookups.factories ?? []).filter((factory: any) => factory.org_id === form.org_id)
  const orgRoles = (lookups.roles ?? []).filter((roleRow: any) => roleRow.org_id === form.org_id)

  const roleOptions = useMemo(() => {
    return Array.from(new Set((lookups.roles ?? []).map((roleRow: any) => roleRow.role_name))).sort()
  }, [lookups.roles])

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return rows.filter((row) => {
      const assignedRole = row.user_roles?.[0]?.roles?.role_name ?? row.role
      const matchesSearch = !search || row.full_name?.toLowerCase().includes(search) || row.email?.toLowerCase().includes(search)
      const matchesOrg = orgId === 'all' || row.org_id === orgId
      const matchesRole = role === 'all' || assignedRole === role
      const matchesStatus = status === 'all' || (status === 'active' ? row.is_active : !row.is_active)
      return matchesSearch && matchesOrg && matchesRole && matchesStatus
    })
  }, [orgId, query, role, rows, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function updateForm(key: string, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'org_id' ? { tenant_id: '', role_id: '' } : {}),
    }))
  }

  function submit() {
    setError('')
    setCredentials(null)
    startTransition(async () => {
      const response = await superadminUsers.create({
        email: form.email,
        password: form.temporaryPassword,
        full_name: fullName(form.firstName, form.lastName),
        org_id: form.org_id,
        tenant_id: form.tenant_id || null,
        role_id: form.role_id,
        phone: form.phone,
        is_active: form.is_active,
      })
      if (response.error || !response.data) {
        setError(response.error ?? 'Failed to create user.')
        return
      }
      setCredentials({ email: form.email, password: form.temporaryPassword })
      const refreshed = await superadminUsers.listAll()
      if (refreshed.data) setRows(refreshed.data)
      setForm({ firstName: '', lastName: '', email: '', temporaryPassword: '', org_id: '', tenant_id: '', role_id: '', phone: '', is_active: true })
      setPanelOpen(false)
    })
  }

  async function copyPassword() {
    if (credentials?.password) await navigator.clipboard.writeText(credentials.password)
  }

  return (
    <div className="user-page">
      <div className="org-page__header">
        <div>
          <h1>Users</h1>
          <p>Manage Supabase Auth users, ERP user profiles, roles, and account status.</p>
        </div>
        <Button onClick={() => setPanelOpen(true)}>New User</Button>
      </div>

      <div className="user-toolbar">
        <Input label="Search" placeholder="Search name or email" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value) }} />
        <label>Organisation<select value={orgId} onChange={(event) => { setPage(1); setOrgId(event.target.value) }}>
          <option value="all">All</option>
          {(lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select></label>
        <label>Role<select value={role} onChange={(event) => { setPage(1); setRole(event.target.value) }}>
          <option value="all">All</option>
          {roleOptions.map((roleName: any) => <option key={roleName} value={roleName}>{roleName}</option>)}
        </select></label>
        <label>Status<select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select></label>
      </div>

      <div className="super-table">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Organisation</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <td><Link href={`/superadmin/users/${row.id}`}>{row.full_name}</Link></td>
                <td>{row.email}</td>
                <td>{row.organisations?.name ?? '-'}</td>
                <td>{row.user_roles?.[0]?.roles?.role_name ?? row.role}</td>
                <td><Badge variant={row.is_active ? 'success' : 'slate'}>{row.is_active ? 'Active' : 'Inactive'}</Badge></td>
                <td>{row.last_login ? new Date(row.last_login).toLocaleString('en-IN') : '-'}</td>
                <td><Link className="text-link" href={`/superadmin/users/${row.id}`}>Open</Link></td>
              </tr>
            ))}
            {!visibleRows.length && <tr><td colSpan={7}>No users found.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>{filtered.length} users</span>
        <div>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
          <span>Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button>
        </div>
      </div>

      {panelOpen && (
        <div className="slide-over" role="dialog" aria-modal="true" aria-label="Create user">
          <button className="slide-over__backdrop" onClick={() => setPanelOpen(false)} aria-label="Close panel" />
          <div className="slide-over__panel">
            <div className="slide-over__header">
              <h2>New User</h2>
              <Button variant="ghost" size="sm" onClick={() => setPanelOpen(false)}>Close</Button>
            </div>
            <div className="slide-over__body">
              <div className="form-grid">
                <Input label="First Name" value={form.firstName} onChange={(event) => updateForm('firstName', event.target.value)} />
                <Input label="Last Name" value={form.lastName} onChange={(event) => updateForm('lastName', event.target.value)} />
              </div>
              <Input label="Email" type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} />
              <Input label="Temporary Password" type="password" value={form.temporaryPassword} onChange={(event) => updateForm('temporaryPassword', event.target.value)} />
              <label>Organisation<select value={form.org_id} onChange={(event) => updateForm('org_id', event.target.value)}>
                <option value="">Select organisation</option>
                {(lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select></label>
              <label>Factory<select value={form.tenant_id} onChange={(event) => updateForm('tenant_id', event.target.value)}>
                <option value="">No factory</option>
                {orgFactories.map((factory: any) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}
              </select></label>
              <label>Role<select value={form.role_id} onChange={(event) => updateForm('role_id', event.target.value)}>
                <option value="">Select role</option>
                {orgRoles.map((roleRow: any) => <option key={roleRow.id} value={roleRow.id}>{roleRow.role_name}</option>)}
              </select></label>
              <Input label="Phone" value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} />
              <label className="toggle-row"><input type="checkbox" checked={form.is_active} onChange={(event) => updateForm('is_active', event.target.checked)} /> Active</label>
              {error && <div className="form-error">{error}</div>}
            </div>
            <div className="slide-over__footer">
              <Button variant="outline" onClick={() => setPanelOpen(false)}>Cancel</Button>
              <Button loading={isPending} onClick={submit}>Create User</Button>
            </div>
          </div>
        </div>
      )}

      {credentials && (
        <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Temporary credentials">
          <button className="modal-shell__backdrop" onClick={() => setCredentials(null)} aria-label="Close modal" />
          <div className="modal-shell__panel">
            <div className="modal-shell__header"><h2>Temporary Credentials</h2><Button variant="ghost" size="sm" onClick={() => setCredentials(null)}>Close</Button></div>
            <div className="modal-shell__body">
              <p>Email: <strong>{credentials.email}</strong></p>
              <p>Password: <strong>{credentials.password}</strong></p>
              <Button variant="outline" onClick={copyPassword}>Copy Password</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
