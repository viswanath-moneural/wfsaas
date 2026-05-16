import { superadminAuditLog, superadminOrganisations } from '@/app/actions/superadmin'
import AuditLogClient from './AuditLogClient'

export default async function AuditLogPage() {
  const [auditResult, orgsResult] = await Promise.all([
    superadminAuditLog.listAll({ limit: 200 }),
    superadminOrganisations.listAll(),
  ])

  return (
    <>
      {(auditResult.error || orgsResult.error) && <div className="error-panel">{auditResult.error ?? orgsResult.error}</div>}
      <AuditLogClient initialRows={auditResult.data ?? []} organisations={orgsResult.data ?? []} />
    </>
  )
}
