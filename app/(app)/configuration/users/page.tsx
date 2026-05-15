'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'

interface UserRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string | null
  is_active: boolean
  tenants: { name: string } | null
}

interface RoleRow {
  id: string
  role_name: string
}

export default function ConfigurationUsersPage() {
  const { org, allTenants, user, permissions } = useAuth()
  const role = String(user?.role ?? '').toLowerCase()
  const canEdit = Boolean(permissions?.is_admin || role === 'superadmin' || role === 'owner' || role === 'admin')
  const [rows, setRows] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'manager',
    tenant_id: '',
  })

  useEffect(() => {
    if (!org?.id) {
      setLoading(false)
      return
    }
    void load(org.id)
  }, [org?.id])

  async function load(orgId: string) {
    const supabase = getSupabaseClient()
    setLoading(true)
    setError('')
    const [{ data: usersData, error: usersError }, { data: rolesData, error: rolesError }] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, email, phone, role, is_active, tenants(name)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase
        .from('roles')
        .select('id, role_name')
        .eq('org_id', orgId)
        .order('role_name', { ascending: true }),
    ])
    if (usersError) setError(usersError.message)
    if (rolesError) setError(rolesError.message)
    setRows((usersData as unknown as UserRow[]) ?? [])
    setRoles((rolesData as RoleRow[]) ?? [])
    setLoading(false)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!org?.id || !canEdit) return
    setSaving(true)
    setError('')
    const supabase = getSupabaseClient()
    const selectedRole = roles.find((item) => item.role_name === form.role)
    const newId = crypto.randomUUID()
    const { error: userInsertError } = await supabase.from('users').insert({
      id: newId,
      org_id: org.id,
      tenant_id: form.tenant_id || null,
      full_name: form.full_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || '0000000000',
      role: form.role as any,
      is_active: true,
    })
    if (userInsertError) {
      setSaving(false)
      setError(userInsertError.message)
      return
    }
    if (selectedRole?.id) {
      const { error: roleAssignError } = await supabase.from('user_roles').insert({
        user_id: newId,
        role_id: selectedRole.id,
        assigned_by: user?.id ?? null,
        is_active: true,
      })
      if (roleAssignError) {
        setSaving(false)
        setError(roleAssignError.message)
        return
      }
    }
    setSaving(false)
    setForm({ full_name: '', email: '', phone: '', role: 'manager', tenant_id: '' })
    await load(org.id)
  }

  const columns: Column<UserRow>[] = useMemo(() => [
    { key: 'full_name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone', render: (value) => value || '-' },
    { key: 'role', header: 'Role', render: (value) => value || '-' },
    { key: 'tenants', header: 'Factory', render: (_value, row) => row.tenants?.name ?? 'All / Unassigned' },
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
              <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} disabled={!canEdit} />
              <label><span>Role</span><select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} disabled={!canEdit}>{roles.map((item) => <option key={item.id} value={item.role_name}>{item.role_name}</option>)}</select></label>
              <label><span>Factory</span><select value={form.tenant_id} onChange={(e) => setForm((p) => ({ ...p, tenant_id: e.target.value }))} disabled={!canEdit}><option value="">Org level / unassigned</option>{allTenants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              {error && <p className="form-error">{error}</p>}
              <Button type="submit" loading={saving} disabled={!canEdit} fullWidth>Add user</Button>
            </form>
          </Card>
          <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No users found" emptyMessage="Add users and assign them roles." searchable searchPlaceholder="Search users..." />
        </section>
      )}
      <style jsx>{`
        .layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: var(--space-6); align-items: start; }
        h2 { margin: 0 0 var(--space-4); font-size: var(--text-lg); }
        form { display: flex; flex-direction: column; gap: var(--space-4); }
        label { display: flex; flex-direction: column; gap: var(--space-1-5); }
        select { height: var(--input-height-md); border: 1px solid var(--border-default); border-radius: var(--input-radius); padding: 0 var(--input-px); background: var(--surface-input); }
        .form-error { margin: 0; color: var(--text-danger); font-size: var(--text-sm); }
        @media (max-width: 920px) { .layout { grid-template-columns: 1fr; } }
      `}</style>
    </>
  )
}
