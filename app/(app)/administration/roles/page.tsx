import { adminRoles } from '@/app/actions/admin'
import RolesAdminClient from './RolesAdminClient'

export default async function AdministrationRolesPage() {
  const [rolesResult, lookupsResult] = await Promise.all([
    adminRoles.getAll(),
    adminRoles.getLookups(),
  ])

  const userCounts = (lookupsResult.data?.users ?? []).reduce((counts: Record<string, number>, user: any) => {
    if (user.role_id) counts[user.role_id] = (counts[user.role_id] ?? 0) + 1
    return counts
  }, {})

  return (
    <>
      {(rolesResult.error || lookupsResult.error) && <div className="error-panel">{rolesResult.error ?? lookupsResult.error}</div>}
      <RolesAdminClient
        initialRoles={rolesResult.data ?? []}
        userCounts={userCounts}
        lookups={lookupsResult.data ?? { currentUser: null, organisations: [], users: [] }}
      />
    </>
  )
}





