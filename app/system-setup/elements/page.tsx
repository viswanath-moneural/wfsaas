import ElementsManagerClient from './ElementsManagerClient'
import { listBusinessUnitsForSetup, listElements } from '@/app/actions/systemSetup/elementEngine'

export default async function SystemSetupElementsPage({
  searchParams,
}: {
  searchParams: Promise<{ businessUnitId?: string }>
}) {
  const params = await searchParams
  const [result, unitsResult] = await Promise.all([
    listElements(params.businessUnitId ?? null),
    listBusinessUnitsForSetup(),
  ])
  if (result.error) {
    return <div className="error-panel">{result.error}</div>
  }
  return (
    <ElementsManagerClient
      initialElements={result.data ?? []}
      businessUnits={unitsResult.data ?? []}
      selectedBusinessUnitId={params.businessUnitId ?? null}
    />
  )
}
