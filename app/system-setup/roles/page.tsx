import RolesManagerClient from './RolesManagerClient'
import { getRoleManagerData } from '@/app/actions/systemSetup/roles'

export default async function SystemSetupRolesPage() {
  const result = await getRoleManagerData()

  if (result.error) {
    return <div className="error-panel">{result.error}</div>
  }

  return <RolesManagerClient initialRoles={result.data?.roles ?? []} userCounts={result.data?.userCounts ?? {}} />
}
