import { notFound } from 'next/navigation'
import { adminPermissionSets } from '@/app/actions/admin'
import PermissionSetDetailClient from './PermissionSetDetailClient'

export default async function AdministrationPermissionSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await adminPermissionSets.getDetail(id)

  if (result.error || !result.data) {
    return <div className="error-panel">{result.error ?? 'Permission set not found.'}</div>
  }

  if (!result.data.permissionSet) notFound()

  return <PermissionSetDetailClient initialData={result.data} />
}
