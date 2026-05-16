'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import { adminUsers } from '@/app/actions/admin'

const PAGE_SIZE = 25

function fullName(user: any): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
}

function initials(user: any): string {
  return fullName(user).split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function UsersAdminClient({ initialUsers, lookups }: { initialUsers: any[]; lookups: any }) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [query, setQuery] = useState('')
  const [roleId, setRoleId] = useState('all')
  const [profileId, setProfileId] = useState('all')
  const [businessUnitId, setBusinessUnitId] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [passwordModal, setPasswordModal] = useState<{ email: string; password: string } | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    id: '',
    org_id: lookups.organisations?.[0]?.id ?? '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    business_unit_id: '',
    role_id: '',
    profile_id: '',
    business_unit_ids: [] as string[],
    password: '',
    password_reset_required: true,
    is_active: true,
  })

  const isSuperadmin = lookups.currentUser?.is_superadmin === true
  const scopedBusinessUnits = (lookups.businessUnits ?? []).filter((businessUnit: any) => !form.org_id || businessUnit.org_id === form.org_id)
  const scopedRoles = (lookups.roles ?? []).filter((role: any) => !form.org_id || role.org_id === form.org_id || role.org_id === null)
  const scopedProfiles = (lookups.profiles ?? []).filter((profile: any) => !form.org_id || profile.org_id === form.org_id || profile.org_id === null)

  const stats = useMemo(() => {
    const active = users.filter((user) => user.is_active !== false).length
    const admins = users.filter((user) => ['superadmin', 'owner', 'admin'].includes(user.role?.name)).length
    return { total: users.length, active, inactive: users.length - active, admins }
  }, [users])

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesSearch = !search || fullName(user).toLowerCase().includes(search) || user.email?.toLowerCase().includes(search)
      const matchesRole = roleId === 'all' || user.role_id === roleId
      const matchesProfile = profileId === 'all' || user.profile_id === profileId
      const matchesBusinessUnit = businessUnitId === 'all' || user.business_unit_id === businessUnitId
      const matchesStatus = status === 'all' || (status === 'active' ? user.is_active !== false : user.is_active === false)
      return matchesSearch && matchesRole && matchesProfile && matchesBusinessUnit && matchesStatus
    })
  }, [businessUnitId, profileId, query, roleId, status, users])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function refresh() {
    startTransition(async () => {
      const result = await adminUsers.getAll(isSuperadmin ? undefined : lookups.currentUser?.org_id)
      if (result.data) setUsers(result.data)
    })
  }

  function openCreate() {
    setEditingUser(null)
    setForm({
      id: '',
      org_id: lookups.organisations?.[0]?.id ?? '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      designation: '',
      department: '',
      business_unit_id: '',
      role_id: '',
      profile_id: '',
      business_unit_ids: [],
      password: '',
      password_reset_required: true,
      is_active: true,
    })
    setPanelOpen(true)
  }

  function openEdit(user: any) {
    setEditingUser(user)
    setForm({
      id: user.id,
      org_id: user.org_id ?? '',
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      designation: user.designation ?? '',
      department: user.department ?? '',
      business_unit_id: user.business_unit_id ?? '',
      role_id: user.role_id ?? '',
      profile_id: user.profile_id ?? '',
      business_unit_ids: [],
      password: '',
      password_reset_required: user.password_reset_required !== false,
      is_active: user.is_active !== false,
    })
    setPanelOpen(true)
  }

  function submit() {
    setError('')
    setSuccess('')
    startTransition(async () => {
      const payload = {
        org_id: form.org_id,
        business_unit_id: form.business_unit_id || null,
        role_id: form.role_id || null,
        profile_id: form.profile_id || null,
        first_name: form.first_name,
        last_name: form.last_name || null,
        email: form.email,
        phone: form.phone || null,
        designation: form.designation || null,
        department: form.department || null,
        password_reset_required: form.password_reset_required,
        is_active: form.is_active,
      }

      const result = editingUser
        ? await adminUsers.update(form.id, payload)
        : await adminUsers.create({ ...payload, password: form.password, business_unit_ids: form.business_unit_ids })

      if (result.error || !result.data) {
        setError(result.error ?? 'Save failed.')
        return
      }

      setPanelOpen(false)
      if (!editingUser && result.data.temporaryPassword) {
        setPasswordModal({ email: form.email, password: result.data.temporaryPassword })
      } else {
        setSuccess('User updated.')
      }
      refresh()
    })
  }

  function resetPassword(user: any) {
    startTransition(async () => {
      const result = await adminUsers.resetPassword(user.id)
      if (result.error || !result.data) {
        setError(result.error ?? 'Password reset failed.')
        return
      }
      setPasswordModal({ email: user.email, password: result.data.temporaryPassword })
    })
  }

  function toggleStatus(user: any) {
    startTransition(async () => {
      const result = user.is_active === false ? await adminUsers.activate(user.id) : await adminUsers.suspend(user.id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function deleteUser(user: any) {
    if (!window.confirm(`Delete ${user.email}? This removes the Auth user too.`)) return
    startTransition(async () => {
      const result = await adminUsers.delete(user.id)
      if (result.error) setError(result.error)
      else refresh()
    })
  }

  function toggleBusinessUnitSelection(businessUnitId: string) {
    setForm((current) => ({
      ...current,
      business_unit_ids: current.business_unit_ids.includes(businessUnitId)
        ? current.business_unit_ids.filter((id) => id !== businessUnitId)
        : [...current.business_unit_ids, businessUnitId],
    }))
  }

  return (
    <div className="admin-users-page">
      <div className="admin-page-header">
        <div>
          <h1>Users</h1>
          <p>Manage login users, roles, profiles, businessUnit access, and account status.</p>
        </div>
        <Button onClick={openCreate}>New User</Button>
      </div>

      <div className="admin-stats">
        <Stat label="Total Users" value={stats.total} />
        <Stat label="Active" value={stats.active} />
        <Stat label="Inactive" value={stats.inactive} />
        <Stat label="Admins" value={stats.admins} />
      </div>

      <div className="admin-filter-bar">
        <Input label="Search" placeholder="Name or email" value={query} onChange={(event) => { setPage(1); setQuery(event.target.value) }} />
        <label>Role<select value={roleId} onChange={(event) => { setPage(1); setRoleId(event.target.value) }}><option value="all">All</option>{(lookups.roles ?? []).map((role: any) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
        <label>Profile<select value={profileId} onChange={(event) => { setPage(1); setProfileId(event.target.value) }}><option value="all">All</option>{(lookups.profiles ?? []).map((profile: any) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
        <label>Business Unit<select value={businessUnitId} onChange={(event) => { setPage(1); setBusinessUnitId(event.target.value) }}><option value="all">All</option>{(lookups.businessUnits ?? []).map((businessUnit: any) => <option key={businessUnit.id} value={businessUnit.id}>{businessUnit.name}</option>)}</select></label>
        <label>Status<select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <div className="super-table">
        <table>
          <thead><tr><th>Avatar+Name</th><th>Email</th><th>Role</th><th>Profile</th><th>BusinessUnit</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            {visibleUsers.map((user) => (
              <tr key={user.id}>
                <td><button className="user-name-button" onClick={() => router.push(`/administration/users/${user.id}`)}><span className="avatar-mini">{initials(user)}</span><strong>{fullName(user)}</strong></button></td>
                <td>{user.email}</td>
                <td>{user.role?.label ?? '-'}</td>
                <td>{user.profile?.label ?? '-'}</td>
                <td>{user.businessUnit?.name ?? '-'}</td>
                <td><Badge variant={user.is_active === false ? 'danger' : 'success'}>{user.is_active === false ? 'Inactive' : 'Active'}</Badge></td>
                <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString('en-IN') : '-'}</td>
                <td><div className="row-actions"><Button size="xs" variant="outline" onClick={() => openEdit(user)}>Edit</Button><Button size="xs" variant="outline" onClick={() => resetPassword(user)}>Key</Button><Button size="xs" variant="outline" onClick={() => toggleStatus(user)}>{user.is_active === false ? 'Activate' : 'Suspend'}</Button><Button size="xs" variant="danger" onClick={() => deleteUser(user)}>Delete</Button></div></td>
              </tr>
            ))}
            {!visibleUsers.length && <tr><td colSpan={8}>No users found.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="pagination"><span>{filtered.length} users</span><div><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button><span>Page {page} of {pageCount}</span><Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>

      {panelOpen && (
        <div className="slide-over" role="dialog" aria-modal="true" aria-label={editingUser ? 'Edit user' : 'Create user'}>
          <button className="slide-over__backdrop" onClick={() => setPanelOpen(false)} aria-label="Close panel" />
          <div className="slide-over__panel">
            <div className="slide-over__header"><h2>{editingUser ? 'Edit User' : 'New User'}</h2><Button size="sm" variant="ghost" onClick={() => setPanelOpen(false)}>Close</Button></div>
            <div className="slide-over__body">
              <h3>Personal</h3>
              <div className="form-grid"><Input label="First Name" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /><Input label="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              <Input label="Email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <div className="form-grid"><Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><Input label="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
              <Input label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              <h3>Access</h3>
              {isSuperadmin && <label>Organisation<select value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value, business_unit_id: '', role_id: '', profile_id: '', business_unit_ids: [] })}>{(lookups.organisations ?? []).map((org: any) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>}
              <label>Business Unit*<select required value={form.business_unit_id} onChange={(e) => setForm({ ...form, business_unit_id: e.target.value })}><option value="">Select business unit</option>{scopedBusinessUnits.map((businessUnit: any) => <option key={businessUnit.id} value={businessUnit.id}>{businessUnit.name}</option>)}</select></label>
              <label>Role*<select required value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}><option value="">Select role</option>{scopedRoles.map((role: any) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
              <label>Profile*<select required value={form.profile_id} onChange={(e) => setForm({ ...form, profile_id: e.target.value })}><option value="">Select profile</option>{scopedProfiles.map((profile: any) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
              {!editingUser && <div><h3>Additional Business Units</h3><div className="multi-select-list">{scopedBusinessUnits.map((businessUnit: any) => <label key={businessUnit.id}><input type="checkbox" checked={form.business_unit_ids.includes(businessUnit.id)} onChange={() => toggleBusinessUnitSelection(businessUnit.id)} /> {businessUnit.name}</label>)}</div></div>}
              {!editingUser && <><h3>Security</h3><Input label="Temporary Password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><label className="toggle-row"><input type="checkbox" checked={form.password_reset_required} onChange={(e) => setForm({ ...form, password_reset_required: e.target.checked })} /> Force password reset</label></>}
              <h3>Status</h3><label className="toggle-row"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
            </div>
            <div className="slide-over__footer"><Button variant="outline" onClick={() => setPanelOpen(false)}>Cancel</Button><Button loading={isPending} onClick={submit}>{editingUser ? 'Save User' : 'Create User'}</Button></div>
          </div>
        </div>
      )}

      {passwordModal && <PasswordModal email={passwordModal.email} password={passwordModal.password} onClose={() => setPasswordModal(null)} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function PasswordModal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-label="Temporary password">
      <button className="modal-shell__backdrop" onClick={onClose} aria-label="Close modal" />
      <div className="modal-shell__panel"><div className="modal-shell__header"><h2>User created</h2><Button size="sm" variant="ghost" onClick={onClose}>Close</Button></div><div className="modal-shell__body"><p>{email}</p><p>Temp password: <strong>{password}</strong></p><Button variant="outline" onClick={() => navigator.clipboard.writeText(password)}>Copy Password</Button></div></div>
    </div>
  )
}












