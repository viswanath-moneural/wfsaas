'use client'

import { useMemo, useState, useTransition } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { superadminAuditLog } from '@/app/actions/superadmin'

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export default function AuditLogClient({ initialRows, organisations }: { initialRows: any[]; organisations: any[] }) {
  const [rows, setRows] = useState(initialRows)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [filters, setFilters] = useState({ action: '', entityType: '', orgId: '', actor: '', dateFrom: '', dateTo: '' })

  const actionTypes = useMemo(() => Array.from(new Set(rows.map((row) => row.action).filter(Boolean))).sort(), [rows])
  const entityTypes = useMemo(() => Array.from(new Set(rows.map((row) => row.entity_type ?? row.table_name).filter(Boolean))).sort(), [rows])

  function applyFilters() {
    setError('')
    startTransition(async () => {
      const response = await superadminAuditLog.listAll({
        action: filters.action || undefined,
        entity_type: filters.entityType || undefined,
        org_id: filters.orgId || undefined,
        actor_id: filters.actor || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        limit: 500,
      })
      if (response.error || !response.data) {
        setError(response.error ?? 'Failed to load audit log.')
        return
      }
      setRows(response.data)
    })
  }

  function exportCsv() {
    const headers = ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity Name', 'Org', 'Changes']
    const lines = rows.map((row) => [
      row.created_at ?? row.changed_at,
      row.actor_email ?? row.actor_id ?? row.changed_by,
      row.action,
      row.entity_type ?? row.table_name,
      row.entity_name ?? row.record_id,
      row.organisations?.name ?? row.org_id,
      JSON.stringify(row.changes ?? { before: row.old_data, after: row.new_data }),
    ].map(csvEscape).join(','))
    const blob = new Blob([[headers.map(csvEscape).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="audit-page">
      <div className="org-page__header">
        <div>
          <h1>Audit Log</h1>
          <p>Review superadmin and platform mutations with before/after change history.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>Export to CSV</Button>
      </div>

      <div className="audit-toolbar">
        <label>Action<select value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}>
          <option value="">All actions</option>
          {actionTypes.map((action: any) => <option key={action} value={action}>{action}</option>)}
        </select></label>
        <label>Entity<select value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}>
          <option value="">All entities</option>
          {entityTypes.map((entity: any) => <option key={entity} value={entity}>{entity}</option>)}
        </select></label>
        <label>Organisation<select value={filters.orgId} onChange={(event) => setFilters({ ...filters, orgId: event.target.value })}>
          <option value="">All organisations</option>
          {organisations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select></label>
        <Input label="Actor ID" value={filters.actor} onChange={(event) => setFilters({ ...filters, actor: event.target.value })} />
        <Input label="From" type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} />
        <Input label="To" type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} />
        <Button loading={isPending} onClick={applyFilters}>Apply</Button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="super-table">
        <table>
          <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Entity Type</th><th>Entity Name</th><th>Org</th><th>Changes</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const changes = row.changes ?? { before: row.old_data, after: row.new_data }
              return (
                <tr key={row.id} onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="expandable-row">
                  <td>{row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : '-'}</td>
                  <td>{row.actor_email ?? row.actor_id ?? row.changed_by ?? '-'}</td>
                  <td><Badge>{row.action}</Badge></td>
                  <td>{row.entity_type ?? row.table_name}</td>
                  <td>{row.entity_name ?? row.record_id ?? '-'}</td>
                  <td>{row.organisations?.name ?? row.org_id ?? '-'}</td>
                  <td>{expanded === row.id ? <DiffViewer changes={changes} /> : 'View changes'}</td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={7}>No audit entries found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DiffViewer({ changes }: { changes: any }) {
  return (
    <div className="diff-viewer" onClick={(event) => event.stopPropagation()}>
      <div><strong>Before</strong><pre>{JSON.stringify(changes?.before ?? null, null, 2)}</pre></div>
      <div><strong>After</strong><pre>{JSON.stringify(changes?.after ?? null, null, 2)}</pre></div>
    </div>
  )
}





