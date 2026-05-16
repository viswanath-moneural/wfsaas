import { superadminOrganisations, superadminRoles } from '@/app/actions/superadmin'
import RolesClient from './RolesClient'

export default async function RolesPage() {
  const [rolesResult, orgsResult] = await Promise.all([
    superadminRoles.listWithMetrics(),
    superadminOrganisations.listAll(),
  ])

  return (
    <>
      {(rolesResult.error || orgsResult.error) && <div className="error-panel">{rolesResult.error ?? orgsResult.error}</div>}
      <RolesClient roles={rolesResult.data ?? []} organisations={orgsResult.data ?? []} />
    </>
  )
}





