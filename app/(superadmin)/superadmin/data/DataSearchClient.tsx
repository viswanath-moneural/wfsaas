'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { superadminDataSearch } from '@/app/actions/superadmin'

const groups = [
  ['organisations', 'Organisations'],
  ['users', 'Users'],
  ['salesOrders', 'Sales Orders'],
  ['purchaseOrders', 'Purchase Orders'],
  ['inventoryItems', 'Inventory Items'],
  ['parties', 'CRM Parties'],
] as const

export default function DataSearchClient({ initialResults, organisations }: { initialResults: Record<string, any[]>; organisations: any[] }) {
  const [results, setResults] = useState(initialResults)
  const [activeGroup, setActiveGroup] = useState<string>('organisations')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [filters, setFilters] = useState({ query: '', orgId: '', dateFrom: '', dateTo: '' })

  const totalCount = useMemo(() => Object.values(results).reduce((sum, rows) => sum + rows.length, 0), [results])

  function search() {
    setError('')
    startTransition(async () => {
      const response = await superadminDataSearch.globalSearch(filters)
      if (response.error || !response.data) {
        setError(response.error ?? 'Search failed.')
        return
      }
      setResults(response.data)
      const firstGroup = groups.find(([key]) => response.data?.[key]?.length)?.[0] ?? 'organisations'
      setActiveGroup(firstGroup)
    })
  }

  const activeRows = results[activeGroup] ?? []

  return (
    <div className="data-search-page">
      <div className="org-page__header">
        <div>
          <h1>All Records</h1>
          <p>Search globally across organisations, users, sales, purchases, inventory, and CRM parties.</p>
        </div>
      </div>

      <div className="data-search-toolbar">
        <Input label="Search" placeholder="Name, code, email, status, GST" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
        <label>Organisation<select value={filters.orgId} onChange={(event) => setFilters({ ...filters, orgId: event.target.value })}>
          <option value="">All organisations</option>
          {organisations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select></label>
        <Input label="From" type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} />
        <Input label="To" type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} />
        <Button loading={isPending} onClick={search}>Search</Button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="group-tabs">
        {groups.map(([key, label]) => (
          <button key={key} className={activeGroup === key ? 'active' : ''} onClick={() => setActiveGroup(key)}>
            {label} <Badge variant="slate">{results[key]?.length ?? 0}</Badge>
          </button>
        ))}
      </div>

      <div className="super-table">
        <table>
          <thead><tr><th>Type</th><th>Name / Code</th><th>Organisation</th><th>Status</th><th>Created Date</th><th>Action</th></tr></thead>
          <tbody>
            {activeRows.map((row) => (
              <tr key={`${row.type}-${row.id}`}>
                <td><span className="record-icon">{row.icon}</span> {row.type}</td>
                <td><strong>{row.name}</strong><br /><span>{row.code ?? '-'}</span></td>
                <td>{row.orgName ?? '-'}</td>
                <td>{row.status ? <Badge>{row.status}</Badge> : '-'}</td>
                <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN') : '-'}</td>
                <td><Link className="text-link" href={row.href}>View</Link></td>
              </tr>
            ))}
            {!activeRows.length && <tr><td colSpan={6}>No records found in this group.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="pagination"><span>{totalCount} total matching records</span></div>
    </div>
  )
}
