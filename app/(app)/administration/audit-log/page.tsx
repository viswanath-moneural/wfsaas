import { adminAuditLog } from '@/app/actions/admin'
import AuditLogClient from './AuditLogClient'

export default async function AdministrationAuditLogPage() {
  const result = await adminAuditLog.getAll({ limit: 1000 })

  return (
    <>
      {result.error && <div className="error-panel">{result.error}</div>}
      <AuditLogClient initialRows={result.data ?? []} />
    </>
  )
}





