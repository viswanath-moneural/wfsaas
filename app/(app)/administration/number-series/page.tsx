import { adminNumberSeries } from '@/app/actions/admin'
import NumberSeriesAdminClient from './NumberSeriesAdminClient'

export default async function AdministrationNumberSeriesPage() {
  const [seriesResult, lookupsResult] = await Promise.all([
    adminNumberSeries.getAll(),
    adminNumberSeries.getLookups(),
  ])

  return (
    <>
      {(seriesResult.error || lookupsResult.error) && <div className="error-panel">{seriesResult.error ?? lookupsResult.error}</div>}
      <NumberSeriesAdminClient
        initialSeries={seriesResult.data ?? []}
        lookups={lookupsResult.data ?? { currentUser: null, organisations: [], factories: [] }}
      />
    </>
  )
}
