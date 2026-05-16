import { adminUsers } from '@/app/actions/admin'
import UsersAdminClient from './UsersAdminClient'

export default async function AdministrationUsersPage() {
  const [usersResult, lookupsResult] = await Promise.all([
    adminUsers.getAll(),
    adminUsers.getLookups(),
  ])

  return (
    <>
      {(usersResult.error || lookupsResult.error) && <div className="error-panel">{usersResult.error ?? lookupsResult.error}</div>}
      <UsersAdminClient initialUsers={usersResult.data ?? []} lookups={lookupsResult.data ?? { organisations: [], businessUnits: [], roles: [], profiles: [], permissionSets: [] }} />
    </>
  )
}







