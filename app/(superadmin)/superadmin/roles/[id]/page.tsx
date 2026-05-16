import { notFound } from 'next/navigation'
import { superadminRoles } from '@/app/actions/superadmin'
import RoleDetailClient from './RoleDetailClient'

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await superadminRoles.getDetails(id)

  if (!result.data) {
    if (!result.error) notFound()
    return <div className="error-panel">{result.error}</div>
  }

  return <RoleDetailClient initialData={result.data} />
}
