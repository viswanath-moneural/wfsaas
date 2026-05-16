import { notFound } from 'next/navigation'
import { superadminUsers } from '@/app/actions/superadmin'
import UserDetailClient from './UserDetailClient'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await superadminUsers.getDetails(id)

  if (!result.data) {
    if (!result.error) notFound()
    return <div className="error-panel">{result.error}</div>
  }

  return <UserDetailClient initialData={result.data} />
}





