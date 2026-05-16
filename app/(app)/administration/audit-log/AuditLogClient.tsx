'use client'

import { Fragment, useMemo, useState } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const PAGE_SIZE = 50

function getChanges(row: any) {
  const changes = row.changes ?? {}
  return {
    before: changes.before ?? null,
    after: changes.after ?? null,
  }
}

function flattenObject(value: any, prefix = ''): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? { [prefix]: value } : {}
  return Object.entries(value).reduce((acc: Record<string, any>, [key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) return { ...acc, ...flattenObject(child, path) }
    acc[path] = child
    return acc
  }, {})
}

function formatValue(value: any) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function csvEscape(value: any) {
  return `"${formatValue(value).replaceAll('"', '""')}"`
}

export default function AuditLogClient({ initialRows }: { initialRows: any[] }) {
  const [rows] = useState(initialRows)
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('all')
  const [entityType, setEntityType] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [actorEmail, setActorEmail] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const actions = useMemo(() => Array.from(new Set(rows.map((row) => row.action).filter(Boolean))).sort(), [rows])
  const entityTypes = useMemo(() => Array.from(new Set(rows.map((row) => row.entity_type).filter(Boolean))).sort(), [rows])

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    const actor = actorEmail.trim().toLowerCase()
    return rows.filter((row) => {
      const createdAt = row.created_at ? new Date(row.created_at) : null
      const matchesSearch = !search
        || String(row.entity_name ?? '').toLowerCase().includes(search)
        || String(row.actor_email ?? '').toLowerCase().includes(search)
      const matchesActor = !actor || String(row.actor_email ?? '').toLowerCase().includes(actor)
      const matchesAction = action === 'all' || row.action === action
      const matchesEntity = entityType === 'all' || row.entity_type === entityType
      const matchesFrom = !dateFrom || (createdAt && createdAt >= new Date(`${dateFrom}T00:00:00`))
      const matchesTo = !dateTo || (createdAt && createdAt <= new Date(`${dateTo}T23:59:59`))
      return matchesSearch && matchesActor && matchesAction && matchesEntity && matchesFrom && matchesTo
    })
  }, [action, actorEmail, dateFrom, dateTo, entityType, query, rows])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function resetPage(fn: () => void) {
    setPage(1)
    fn()
  }

  function exportCsv() {
    const header = ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity Name', 'Status']
    const lines = filtered.map((row) => [
      row.created_at,
      row.actor_email,
      row.action,
      row.entity_type,
      row.entity_name,
      row.status,
    ].map(csvEscape).join(','))
    const blob = new Blob([[header.map(csvEscape).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="admin-audit-log-page">
      <div className="admin-page-header">
        <div>
          <h1>Audit Log</h1>
          <p>Review administration changes with before and after values.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
      </div>

      <div className="audit-filter-bar">
        <Input label="Search" placeholder="Entity or actor email" value={query} onChange={(event) => resetPage(() => setQuery(event.target.value))} />
        <label>Action Type<select value={action} onChange={(event) => resetPage(() => setAction(event.target.value))}><option value="all">All</option>{actions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Entity Type<select value={entityType} onChange={(event) => resetPage(() => setEntityType(event.target.value))}><option value="all">All</option>{entityTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <Input label="From" type="date" value={dateFrom} onChange={(event) => resetPage(() => setDateFrom(event.target.value))} />
        <Input label="To" type="date" value={dateTo} onChange={(event) => resetPage(() => setDateTo(event.target.value))} />
        <Input label="Actor" placeholder="actor@email.com" value={actorEmail} onChange={(event) => resetPage(() => setActorEmail(event.target.value))} />
      </div>

      <div className="super-table audit-log-table">
        <table>
          <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Entity Type</th><th>Entity Name</th><th>Status</th><th>Details</th></tr></thead>
          <tbody>
            {visibleRows.map((row) => {
              const expanded = expandedId === row.id
              return (
                <Fragment key={row.id}>
                  <tr className="expandable-row" onClick={() => setExpandedId(expanded ? null : row.id)}>
                    <td>{row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : '-'}</td>
                    <td>{row.actor_email ?? '-'}</td>
                    <td>{row.action}</td>
                    <td>{row.entity_type}</td>
                    <td>{row.entity_name ?? '-'}</td>
                    <td><Badge variant={row.status === 'failed' ? 'danger' : 'success'}>{row.status ?? 'success'}</Badge></td>
                    <td><Button size="xs" variant="outline" type="button">{expanded ? 'Hide' : 'View'}</Button></td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={7}>
                        <AuditDiff row={row} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!visibleRows.length && <tr><td colSpan={7}>No audit log entries match the filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>{filtered.length} log entries</span>
        <div>
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
          <span>Page {page} of {pageCount}</span>
          <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button>
        </div>
      </div>
    </div>
  )
}

function AuditDiff({ row }: { row: any }) {
  const { before, after } = getChanges(row)
  const beforeFlat = flattenObject(before)
  const afterFlat = flattenObject(after)
  const keys = Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])).sort()
  const isCreate = !before || Object.keys(beforeFlat).length === 0
  const isDelete = !after || Object.keys(afterFlat).length === 0

  return (
    <div className="audit-diff-panel">
      <div className="audit-diff-summary">
        {isCreate && <Badge variant="success">Create action</Badge>}
        {isDelete && <Badge variant="danger">Delete action</Badge>}
        {!isCreate && !isDelete && <Badge variant="info">Update diff</Badge>}
      </div>
      <div className="audit-diff-grid">
        <div className="audit-before"><strong>Before</strong>{keys.map((key) => <DiffLine key={key} name={key} value={beforeFlat[key]} />)}</div>
        <div className="audit-after"><strong>After</strong>{keys.map((key) => <DiffLine key={key} name={key} value={afterFlat[key]} beforeValue={beforeFlat[key]} />)}</div>
      </div>
    </div>
  )
}

function DiffLine({ name, value, beforeValue }: { name: string; value: any; beforeValue?: any }) {
  const changed = beforeValue !== undefined && formatValue(value) !== formatValue(beforeValue)
  return (
    <div className={changed ? 'changed' : ''}>
      <span>{name}</span>
      <code>{formatValue(value) || '-'}</code>
    </div>
  )
}
