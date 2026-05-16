import { superadminOrganisations } from '@/app/actions/superadmin'
import OrganisationsClient from './OrganisationsClient'

export default async function OrganisationsPage() {
  const result = await superadminOrganisations.listWithMetrics()

  return (
    <>
      {result.error && <div className="error-panel">{result.error}</div>}
      <OrganisationsClient organisations={result.data ?? []} />
    </>
  )
}





