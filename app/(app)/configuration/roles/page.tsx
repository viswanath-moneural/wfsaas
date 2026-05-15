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

interface RoleRow {
  id: string
  role_name: string
  description: string | null
  is_system: boolean
}

const EMPTY_FORM = {
  role_name: '',
  description: '',
}

export default function RolesPage() {
  const { org, user, permissions } = useAuth()
  const role = String(user?.role ?? '').toLowerCase()
  const canEdit = Boolean(permissions?.is_admin || role === 'superadmin' || role === 'owner' || role === 'admin')
  const [rows, setRows] = useState<RoleRow[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
    const { data, error: fetchError } = await supabase
      .from('roles')
      .select('id, role_name, description, is_system')
      .eq('org_id', orgId)
      .order('role_name', { ascending: true })
    if (fetchError) setError(fetchError.message)
    setRows((data as RoleRow[]) ?? [])
    setLoading(false)
  }

  async function createRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!org?.id || !canEdit) return
    setSaving(true)
    setError('')
    const supabase = getSupabaseClient()
    const { error: insertError } = await supabase.from('roles').insert({
      org_id: org.id,
      role_name: form.role_name.trim().toLowerCase(),
      description: form.description.trim() || null,
      is_system: false,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setForm(EMPTY_FORM)
    await load(org.id)
  }

  const columns: Column<RoleRow>[] = useMemo(() => [
    { key: 'role_name', header: 'Role' },
    { key: 'description', header: 'Description', render: (v) => v || '-' },
    { key: 'is_system', header: 'Type', render: (v) => <Badge variant={v ? 'info' : 'slate'}>{v ? 'System' : 'Custom'}</Badge> },
  ], [])

  return (
    <>
      <PageHeader title="Roles" description="Manage organisation roles for user access control." />
      {!org && <Card><p style={{ margin: 0, color: 'var(--text-secondary)' }}>Organisation context missing for this user.</p></Card>}
      {org && (
        <section className="layout">
          <Card>
            <h2>Add Role</h2>
            <form onSubmit={createRole}>
              <Input label="Role name" value={form.role_name} onChange={(e) => setForm((p) => ({ ...p, role_name: e.target.value }))} required disabled={!canEdit} />
              <Input label="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} disabled={!canEdit} />
              {error && <p className="form-error">{error}</p>}
              <Button type="submit" loading={saving} disabled={!canEdit} fullWidth>Add role</Button>
            </form>
          </Card>
          <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No roles found" emptyMessage="Create custom roles for this organisation." searchable searchPlaceholder="Search roles..." />
        </section>
      )}
      <style jsx>{`
        .layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: var(--space-6); align-items: start; }
        h2 { margin: 0 0 var(--space-4); font-size: var(--text-lg); }
        form { display: flex; flex-direction: column; gap: var(--space-4); }
        .form-error { margin: 0; color: var(--text-danger); font-size: var(--text-sm); }
        @media (max-width: 920px) { .layout { grid-template-columns: 1fr; } }
      `}</style>
    </>
  )
}
