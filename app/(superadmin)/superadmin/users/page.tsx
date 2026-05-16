import { superadminUsers } from '@/app/actions/superadmin'
import UsersClient from './UsersClient'

export default async function UsersPage() {
  const [usersResult, lookupsResult] = await Promise.all([
    superadminUsers.listAll(),
    superadminUsers.getManagementLookups(),
  ])

  return (
    <>
      {(usersResult.error || lookupsResult.error) && <div className="error-panel">{usersResult.error ?? lookupsResult.error}</div>}
      <UsersClient users={usersResult.data ?? []} lookups={lookupsResult.data ?? { organisations: [], businessUnits: [], roles: [] }} />
    </>
  )
}







