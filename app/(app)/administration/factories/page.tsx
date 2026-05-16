import { adminFactories } from '@/app/actions/admin'
import FactoriesAdminClient from './FactoriesAdminClient'

export default async function AdministrationFactoriesPage() {
  const [factoriesResult, lookupsResult] = await Promise.all([
    adminFactories.getAll(),
    adminFactories.getLookups(),
  ])

  return (
    <>
      {(factoriesResult.error || lookupsResult.error) && <div className="error-panel">{factoriesResult.error ?? lookupsResult.error}</div>}
      <FactoriesAdminClient
        initialFactories={factoriesResult.data ?? []}
        lookups={lookupsResult.data ?? { currentUser: null, organisations: [] }}
      />
    </>
  )
}
