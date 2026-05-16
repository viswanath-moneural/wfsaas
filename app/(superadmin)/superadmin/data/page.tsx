import { superadminDataSearch, superadminOrganisations } from '@/app/actions/superadmin'
import DataSearchClient from './DataSearchClient'

export default async function DataSearchPage() {
  const [searchResult, orgsResult] = await Promise.all([
    superadminDataSearch.globalSearch({}),
    superadminOrganisations.listAll(),
  ])

  return (
    <>
      {(searchResult.error || orgsResult.error) && <div className="error-panel">{searchResult.error ?? orgsResult.error}</div>}
      <DataSearchClient initialResults={searchResult.data ?? {}} organisations={orgsResult.data ?? []} />
    </>
  )
}
