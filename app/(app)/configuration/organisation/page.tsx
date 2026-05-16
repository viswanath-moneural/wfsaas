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
import { createOrganisation as createOrganisationAction } from '@/app/actions/platform'

interface OrganisationRow {
  id: string
  name: string
  slug: string
  country: string | null
  timezone: string | null
  is_active: boolean
}

const EMPTY_FORM = {
  name: '',
  slug: '',
  country: 'IN',
  timezone: 'Asia/Kolkata',
}

export default function OrganisationPage() {
  const { user } = useAuth()
  const role = String(user?.role ?? '').toLowerCase()
  const { canCreate: canEdit } = usePermissions('configuration')
  const [rows, setRows] = useState<OrganisationRow[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { void load() }, [])

  async function load() {
    const supabase = getSupabaseClient()
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('organisations')
      .select('id, name, slug, country, timezone, is_active')
      .order('created_at', { ascending: false })
    if (fetchError) setError(fetchError.message)
    setRows((data as OrganisationRow[]) ?? [])
    setLoading(false)
  }

  async function createOrganisation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setError('')
    const result = await createOrganisationAction({
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      country: form.country.trim() || null,
      timezone: form.timezone.trim() || null,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setForm(EMPTY_FORM)
    await load()
  }

  const columns: Column<OrganisationRow>[] = useMemo(() => [
    { key: 'name', header: 'Organisation' },
    { key: 'slug', header: 'Slug' },
    { key: 'country', header: 'Country', render: (v) => v || '-' },
    { key: 'timezone', header: 'Timezone', render: (v) => v || '-' },
    { key: 'is_active', header: 'Status', render: (v) => <Badge variant={v ? 'success' : 'slate'}>{v ? 'Active' : 'Inactive'}</Badge> },
  ], [])

  return (
    <>
      <PageHeader title="Organisation" description="Global organisation management for platform admins." />
      <section className="layout">
        <Card>
          <h2>Add Organisation</h2>
          <form onSubmit={createOrganisation}>
            <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required disabled={!canEdit} />
            <Input label="Slug" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} required disabled={!canEdit} />
            <Input label="Country" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} disabled={!canEdit} />
            <Input label="Timezone" value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))} disabled={!canEdit} />
            {error && <p className="form-error">{error}</p>}
            <Button title={!canEdit ? 'You do not have permission to edit configuration.' : undefined} type="submit" loading={saving} disabled={!canEdit} fullWidth>Add organisation</Button>
          </form>
        </Card>
        <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No organisations found" emptyMessage="Create organisations for each customer account." searchable searchPlaceholder="Search organisations..." />
      </section>
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





