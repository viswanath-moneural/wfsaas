import { notFound } from 'next/navigation'
import { adminProfiles } from '@/app/actions/admin'
import ProfileDetailClient from './ProfileDetailClient'

export default async function AdministrationProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await adminProfiles.getDetail(id)

  if (result.error || !result.data) {
    return <div className="error-panel">{result.error ?? 'Profile not found.'}</div>
  }

  if (!result.data.profile) notFound()

  return <ProfileDetailClient initialData={result.data} />
}





