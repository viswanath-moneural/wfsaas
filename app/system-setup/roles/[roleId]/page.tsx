import RoleDetailClient from './RoleDetailClient'
import { getRoleDetailData } from '@/app/actions/systemSetup/roles'

export default async function SystemSetupRoleDetailPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params
  const result = await getRoleDetailData(roleId)

  if (result.error || !result.data) {
    return <div className="error-panel">{result.error ?? 'Role not found.'}</div>
  }

  return <RoleDetailClient data={result.data} />
}
