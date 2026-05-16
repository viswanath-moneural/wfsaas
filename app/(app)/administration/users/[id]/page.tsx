import { notFound } from 'next/navigation'
import { adminUsers } from '@/app/actions/admin'
import UserDetailClient from './UserDetailClient'

export default async function AdministrationUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await adminUsers.getDetail(id)

  if (result.error || !result.data) {
    return (
      <div className="error-panel">
        {result.error ?? 'User not found.'}
      </div>
    )
  }

  if (!result.data.user) notFound()

  return <UserDetailClient initialData={result.data} />
}





