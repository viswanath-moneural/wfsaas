const pageTitles: Record<string, string> = {
  organisations: 'Organisations',
  factories: 'Factories',
  users: 'Users',
  roles: 'Roles & Permissions',
  sessions: 'User Sessions',
  modules: 'Modules',
  'number-series': 'Number Series',
  'custom-fields': 'Custom Fields',
  records: 'All Records',
  'audit-log': 'Audit Log',
  export: 'Data Export',
  settings: 'Settings',
  health: 'Health Check',
}

export default async function SuperadminPlaceholder({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params
  const title = pageTitles[resolvedParams.slug] ?? 'Superadmin Console'

  return (
    <div className="placeholder">
      <h1>{title}</h1>
      <p>This console area is reserved for the dedicated superadmin management screen.</p>
      <div>
        <strong>Available foundation</strong>
        <span>Superadmin guard, service-role actions, RLS-bypassing admin client, and audit logging are ready.</span>
      </div>
    </div>
  )
}
