import { adminBusinessUnits } from '@/app/actions/admin'
import BusinessUnitsAdminClient from './BusinessUnitsAdminClient'

export default async function AdministrationBusinessUnitsPage() {
  const [businessUnitsResult, lookupsResult] = await Promise.all([
    adminBusinessUnits.getAll(),
    adminBusinessUnits.getLookups(),
  ])

  return (
    <>
      {(businessUnitsResult.error || lookupsResult.error) && <div className="error-panel">{businessUnitsResult.error ?? lookupsResult.error}</div>}
      <BusinessUnitsAdminClient
        initialBusinessUnits={businessUnitsResult.data ?? []}
        lookups={lookupsResult.data ?? { currentUser: null, organisations: [] }}
      />
    </>
  )
}











