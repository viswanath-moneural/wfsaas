'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import { createUser } from '@/app/actions/users/createUser'

interface UserRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string | null
  is_active: boolean
  businessUnits: { name: string } | null
}

interface RoleRow {
  id: string
  org_id: string
  role_name: string
}

interface OrganisationRow {
  id: string
  name: string
  slug: string
}

interface BusinessUnitRow {
  id: string
  org_id: string
  name: string
}

export default function ConfigurationUsersPage() {
  const { org, user } = useAuth()
  const role = String(user?.role ?? '').toLowerCase()
  const { canCreate: canEdit } = usePermissions('configuration')
  const [rows, setRows] = useState<UserRow[]>([])
  const [organisations, setOrganisations] = useState<OrganisationRow[]>([])
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    temporary_password: '',
    org_id: org?.id ?? '',
    business_unit_id: '',
    role_id: '',
  })

  useEffect(() => {
    if (!org?.id) {
      setLoading(false)
      return
    }
    setForm((prev) => ({ ...prev, org_id: prev.org_id || org.id }))
    void loadLookups(org.id)
  }, [org?.id])

  useEffect(() => {
    if (!form.org_id) return
    void loadOrgScopedData(form.org_id)
  }, [form.org_id])

  async function loadLookups(defaultOrgId: string) {
    const supabase = getSupabaseClient()
    setLoading(true)
    setError('')
    const { data: orgData, error: orgError } = await supabase
      .from('organisations')
      .select('id, name, slug')
      .order('name', { ascending: true })

    if (orgError) {
      setOrganisations(org ? [{ id: org.id, name: org.name, slug: org.slug }] : [])
      setError(orgError.message)
    } else {
      const loadedOrgs = (orgData as OrganisationRow[]) ?? []
      setOrganisations(loadedOrgs.length > 0 ? loadedOrgs : org ? [{ id: org.id, name: org.name, slug: org.slug }] : [])
    }

    await loadOrgScopedData(defaultOrgId)
  }

  async function loadOrgScopedData(orgId: string) {
    const supabase = getSupabaseClient()
    setLoading(true)
    setError('')
    const [
      { data: usersData, error: usersError },
      { data: rolesData, error: rolesError },
      { data: businessUnitsData, error: businessUnitsError },
    ] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, email, phone, role, is_active, business_units(name)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase
        .from('roles')
        .select('id, org_id, role_name')
        .eq('org_id', orgId)
        .order('role_name', { ascending: true }),
      supabase
        .from('business_units')
        .select('id, org_id, name')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ])
    if (usersError) setError(usersError.message)
    if (rolesError) setError(rolesError.message)
    if (businessUnitsError) setError(businessUnitsError.message)
    setRows((usersData as unknown as UserRow[]) ?? [])
    setRoles((rolesData as RoleRow[]) ?? [])
    setBusinessUnits((businessUnitsData as BusinessUnitRow[]) ?? [])
    setForm((prev) => ({
      ...prev,
      role_id: (rolesData as RoleRow[] | null)?.some((item) => item.id === prev.role_id)
        ? prev.role_id
        : ((rolesData as RoleRow[] | null)?.[0]?.id ?? ''),
      business_unit_id: (businessUnitsData as BusinessUnitRow[] | null)?.some((item) => item.id === prev.business_unit_id)
        ? prev.business_unit_id
        : '',
    }))
    setLoading(false)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.org_id || !canEdit) return
    setSaving(true)
    setError('')

    const result = await createUser({
      name: form.full_name,
      email: form.email,
      temporaryPassword: form.temporary_password,
      org_id: form.org_id,
      business_unit_id: form.business_unit_id || null,
      role_id: form.role_id,
    })

    if (!result.ok) {
      setSaving(false)
      setError(result.message)
      return
    }

    const createdEmail = form.email.trim().toLowerCase()
    const createdPassword = form.temporary_password
    setSaving(false)
    setCreatedCredentials({ email: createdEmail, password: createdPassword })
    setForm((prev) => ({
      full_name: '',
      email: '',
      temporary_password: '',
      org_id: prev.org_id,
      business_unit_id: '',
      role_id: roles[0]?.id ?? '',
    }))
    await loadOrgScopedData(form.org_id)
  }

  const columns: Column<UserRow>[] = useMemo(() => [
    { key: 'full_name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone', render: (value) => value || '-' },
    { key: 'role', header: 'Role', render: (value) => value || '-' },
    { key: 'businessUnits', header: 'BusinessUnit', render: (_value, row) => row.businessUnits?.name ?? 'All / Unassigned' },
    { key: 'is_active', header: 'Status', render: (value) => <Badge variant={value ? 'success' : 'slate'}>{value ? 'Active' : 'Inactive'}</Badge> },
  ], [])

  return (
    <>
      <PageHeader title="Users" description="Create and manage users for this organisation." />
      {!org && <Card><p style={{ margin: 0, color: 'var(--text-secondary)' }}>Organisation context missing. Map org_id in users and relogin.</p></Card>}
      {org && (
        <section className="layout">
          <Card>
            <h2>Add User</h2>
            <form onSubmit={handleCreate}>
              <Input label="Full name" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} required disabled={!canEdit} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required disabled={!canEdit} />
              <Input label="Temporary password" type="text" value={form.temporary_password} onChange={(e) => setForm((p) => ({ ...p, temporary_password: e.target.value }))} required disabled={!canEdit} />
              <label>
                <span>Organisation</span>
                <select value={form.org_id} onChange={(e) => setForm((p) => ({ ...p, org_id: e.target.value, business_unit_id: '', role_id: '' }))} disabled={!canEdit}>
                  {organisations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>
                <span>Role</span>
                <select value={form.role_id} onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))} required disabled={!canEdit || roles.length === 0}>
                  {roles.length === 0 ? <option value="">No roles available</option> : roles.map((item) => <option key={item.id} value={item.id}>{item.role_name}</option>)}
                </select>
              </label>
              <label>
                <span>BusinessUnit</span>
                <select value={form.business_unit_id} onChange={(e) => setForm((p) => ({ ...p, business_unit_id: e.target.value }))} disabled={!canEdit}>
                  <option value="">Org level / unassigned</option>
                  {businessUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              {error && <p className="form-error">{error}</p>}
              <Button title={!canEdit ? 'You do not have permission to edit configuration.' : undefined} type="submit" loading={saving} disabled={!canEdit || !form.org_id || !form.role_id} fullWidth>Create login user</Button>
            </form>
          </Card>
          <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No users found" emptyMessage="Add users and assign them roles." searchable searchPlaceholder="Search users..." />
        </section>
      )}
      {createdCredentials && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="created-user-title">
            <Card>
              <h2 id="created-user-title">User created</h2>
              <p className="modal-text">Share these temporary login credentials with the user.</p>
              <div className="credential-box">
                <span>Email</span>
                <strong>{createdCredentials.email}</strong>
              </div>
              <div className="credential-box">
                <span>Temporary password</span>
                <strong>{createdCredentials.password}</strong>
              </div>
              <Button fullWidth onClick={() => setCreatedCredentials(null)}>Done</Button>
            </Card>
          </div>
        </div>
      )}
      <style jsx>{`
        .layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: var(--space-6); align-items: start; }
        h2 { margin: 0 0 var(--space-4); font-size: var(--text-lg); }
        form { display: flex; flex-direction: column; gap: var(--space-4); }
        label { display: flex; flex-direction: column; gap: var(--space-1-5); }
        select { height: var(--input-height-md); border: 1px solid var(--border-default); border-radius: var(--input-radius); padding: 0 var(--input-px); background: var(--surface-input); }
        .form-error { margin: 0; color: var(--text-danger); font-size: var(--text-sm); }
        .modal-backdrop { position: fixed; inset: 0; z-index: var(--z-modal); display: grid; place-items: center; padding: var(--space-4); background: rgba(15, 23, 42, 0.45); }
        .modal { width: min(440px, 100%); }
        .modal-text { margin: 0 0 var(--space-4); color: var(--text-secondary); font-size: var(--text-sm); }
        .credential-box { display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-3); margin-bottom: var(--space-3); border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--surface-page); }
        .credential-box span { color: var(--text-secondary); font-size: var(--text-xs); }
        .credential-box strong { color: var(--text-primary); font-size: var(--text-base); word-break: break-all; }
        @media (max-width: 920px) { .layout { grid-template-columns: 1fr; } }
      `}</style>
    </>
  )
}













