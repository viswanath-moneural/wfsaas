import { adminPermissionSets } from '@/app/actions/admin'
import PermissionSetsAdminClient from './PermissionSetsAdminClient'

export default async function AdministrationPermissionSetsPage() {
  const [setsResult, lookupsResult] = await Promise.all([
    adminPermissionSets.getAll(),
    adminPermissionSets.getLookups(),
  ])

  const assignedCounts = (lookupsResult.data?.assignments ?? []).reduce((counts: Record<string, number>, assignment: any) => {
    if (assignment.permission_set_id) counts[assignment.permission_set_id] = (counts[assignment.permission_set_id] ?? 0) + 1
    return counts
  }, {})

  return (
    <>
      {(setsResult.error || lookupsResult.error) && <div className="error-panel">{setsResult.error ?? lookupsResult.error}</div>}
      <PermissionSetsAdminClient
        initialPermissionSets={setsResult.data ?? []}
        assignedCounts={assignedCounts}
        lookups={lookupsResult.data ?? { currentUser: null, organisations: [] }}
      />
    </>
  )
}





