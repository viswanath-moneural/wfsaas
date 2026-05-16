import { notFound } from 'next/navigation'
import { superadminOrganisations } from '@/app/actions/superadmin'
import OrganisationDetailClient from './OrganisationDetailClient'

export default async function OrganisationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await superadminOrganisations.getDetails(id)

  if (!result.data) {
    if (!result.error) notFound()
    return <div className="error-panel">{result.error}</div>
  }

  return <OrganisationDetailClient initialData={result.data} />
}





