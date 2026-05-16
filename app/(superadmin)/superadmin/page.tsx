import { superadminAuditLog, superadminModules, superadminOrganisations, superadminUsers } from '@/app/actions/superadmin'

function formatCount(value: number) {
  return new Intl.NumberFormat('en-IN').format(value)
}

export default async function SuperadminDashboard() {
  const [orgsResult, usersResult, auditResult, modulesResult] = await Promise.all([
    superadminOrganisations.listAll(),
    superadminUsers.listAll(),
    superadminAuditLog.listAll({ limit: 50 }),
    superadminModules.listAll(),
  ])

  const organisations = orgsResult.data ?? []
  const users = usersResult.data ?? []
  const auditEntries = auditResult.data ?? []
  const moduleRows = modulesResult.data ?? []
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
  const errorsLast24h = auditEntries.filter((entry: any) => {
    const action = String(entry.action ?? '').toLowerCase()
    const changedAt = new Date(entry.changed_at ?? entry.created_at ?? 0).getTime()
    return changedAt >= oneDayAgo && (action.includes('error') || action.includes('failed'))
  }).length

  const activeSessions = users.filter((user: any) => user.is_active !== false).length
  const modulesByKey = moduleRows.reduce((acc: Record<string, { enabled: number; total: number }>, row: any) => {
    const key = row.module_key ?? 'unknown'
    acc[key] = acc[key] ?? { enabled: 0, total: 0 }
    acc[key].total += 1
    if (row.is_enabled) acc[key].enabled += 1
    return acc
  }, {})

  return (
    <div className="super-dashboard">
      <div className="super-dashboard__header">
        <div>
          <h1>Platform Dashboard</h1>
          <p>Global operating view across organisations, users, modules, and audit activity.</p>
        </div>
      </div>

      <section className="metric-grid" aria-label="Platform summary">
        <article>
          <span>Total Orgs</span>
          <strong>{formatCount(organisations.length)}</strong>
        </article>
        <article>
          <span>Total Users</span>
          <strong>{formatCount(users.length)}</strong>
        </article>
        <article>
          <span>Active Sessions</span>
          <strong>{formatCount(activeSessions)}</strong>
        </article>
        <article>
          <span>Errors Last 24h</span>
          <strong>{formatCount(errorsLast24h)}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel__header">
            <h2>Recent Audit Log</h2>
            <span>Last 10 actions</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Table</th>
                  <th>User</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.slice(0, 10).map((entry: any) => (
                  <tr key={entry.id}>
                    <td>{entry.action}</td>
                    <td>{entry.table_name}</td>
                    <td>{entry.changed_by ?? '-'}</td>
                    <td>{entry.changed_at ? new Date(entry.changed_at).toLocaleString('en-IN') : '-'}</td>
                  </tr>
                ))}
                {!auditEntries.length && (
                  <tr>
                    <td colSpan={4}>No audit activity yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <h2>Module Status</h2>
            <span>Enabled by organisation</span>
          </div>
          <div className="module-grid">
            {Object.entries(modulesByKey).map(([moduleKey, status]) => (
              <div key={moduleKey} className="module-card">
                <strong>{moduleKey}</strong>
                <span>{status.enabled} of {status.total} orgs enabled</span>
              </div>
            ))}
            {!Object.keys(modulesByKey).length && <p>No module configuration found.</p>}
          </div>
        </div>
      </section>

      {(orgsResult.error || usersResult.error || auditResult.error || modulesResult.error) && (
        <div className="error-panel">
          {[orgsResult.error, usersResult.error, auditResult.error, modulesResult.error].filter(Boolean).join(' ')}
        </div>
      )}
    </div>
  )
}





