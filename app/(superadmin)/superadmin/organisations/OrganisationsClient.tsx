'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { superadminOrganisations } from '@/app/actions/superadmin'

const PAGE_SIZE = 25
const plans = ['Free', 'Pro', 'Enterprise'] as const

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function OrganisationsClient({ organisations }: { organisations: any[] }) {
  const [rows, setRows] = useState(organisations)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [panelOpen, setPanelOpen] = useState(false)
  const [result, setResult] = useState<{ organisationId: string; factoryId: string; adminUserId: string } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: '',
    slug: '',
    plan: 'Free',
    adminEmail: '',
    adminName: '',
    adminPassword: '',
  })

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch = !search || row.name?.toLowerCase().includes(search) || row.slug?.toLowerCase().includes(search)
      const matchesStatus = status === 'all' || (status === 'active' ? row.is_active : !row.is_active)
      return matchesSearch && matchesStatus
    })
  }, [query, rows, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function updateForm(key: string, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'name' && (!current.slug || current.slug === slugify(current.name)) ? { slug: slugify(value) } : {}),
    }))
  }

  function submit() {
    setError('')
    setResult(null)
    startTransition(async () => {
      const response = await superadminOrganisations.createWithSetup({
        name: form.name,
        slug: form.slug,
        plan: form.plan as 'Free' | 'Pro' | 'Enterprise',
        adminEmail: form.adminEmail,
        adminName: form.adminName,
        adminPassword: form.adminPassword,
      })

      if (response.error || !response.data) {
        setError(response.error ?? 'Failed to create organisation.')
        return
      }

      setResult(response.data)
      const refreshed = await superadminOrganisations.listWithMetrics()
      if (refreshed.data) setRows(refreshed.data)
      setForm({ name: '', slug: '', plan: 'Free', adminEmail: '', adminName: '', adminPassword: '' })
    })
  }

  async function copyId() {
    if (!result?.organisationId) return
    await navigator.clipboard.writeText(result.organisationId)
  }

  return (
    <div className="org-page">
      <div className="org-page__header">
        <div>
          <h1>Organisations</h1>
          <p>Manage customer companies, subscription plans, factories, users, and module access.</p>
        </div>
        <Button onClick={() => setPanelOpen(true)}>New Organisation</Button>
      </div>

      <div className="org-toolbar">
        <Input
          label="Search"
          placeholder="Search by name or slug"
          value={query}
          onChange={(event) => {
            setPage(1)
            setQuery(event.target.value)
          }}
        />
        <label>
          Status
          <select
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value)
            }}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
      </div>

      <div className="super-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Factory Count</th>
              <th>User Count</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <td><Link href={`/superadmin/organisations/${row.id}`}>{row.name}</Link></td>
                <td>{row.slug}</td>
                <td>{row.plan}</td>
                <td><Badge variant={row.is_active ? 'success' : 'danger'}>{row.is_active ? 'Active' : 'Suspended'}</Badge></td>
                <td>{row.factory_count}</td>
                <td>{row.user_count}</td>
                <td>{row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '-'}</td>
                <td><Link className="text-link" href={`/superadmin/organisations/${row.id}`}>Open</Link></td>
              </tr>
            ))}
            {!visibleRows.length && (
              <tr><td colSpan={8}>No organisations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>{filtered.length} organisations</span>
        <div>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
          <span>Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button>
        </div>
      </div>

      {panelOpen && (
        <div className="slide-over" role="dialog" aria-modal="true" aria-label="Create organisation">
          <button className="slide-over__backdrop" onClick={() => setPanelOpen(false)} aria-label="Close panel" />
          <div className="slide-over__panel">
            <div className="slide-over__header">
              <h2>New Organisation</h2>
              <Button variant="ghost" size="sm" onClick={() => setPanelOpen(false)}>Close</Button>
            </div>

            <div className="slide-over__body">
              <Input label="Organisation Name" required value={form.name} onChange={(event) => updateForm('name', event.target.value)} />
              <Input label="Slug" required value={form.slug} onChange={(event) => updateForm('slug', event.target.value)} />
              <label>
                Plan
                <select value={form.plan} onChange={(event) => updateForm('plan', event.target.value)}>
                  {plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                </select>
              </label>
              <Input label="Admin Email" required type="email" value={form.adminEmail} onChange={(event) => updateForm('adminEmail', event.target.value)} />
              <Input label="Admin Name" required value={form.adminName} onChange={(event) => updateForm('adminName', event.target.value)} />
              <Input label="Admin Password" required type="password" value={form.adminPassword} onChange={(event) => updateForm('adminPassword', event.target.value)} />

              {error && <div className="form-error">{error}</div>}
              {result && (
                <div className="success-box">
                  <strong>Organisation created</strong>
                  <span>Org ID: {result.organisationId}</span>
                  <Button size="sm" variant="outline" onClick={copyId}>Copy Org ID</Button>
                </div>
              )}
            </div>

            <div className="slide-over__footer">
              <Button variant="outline" onClick={() => setPanelOpen(false)}>Cancel</Button>
              <Button loading={isPending} onClick={submit}>Create Organisation</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
