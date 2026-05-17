import { getElementDetail, listElements } from '@/app/actions/systemSetup/elementEngine'
import ElementDetailShell from '../ElementDetailShell'

export default async function ElementDataPointsPage({ params, searchParams }: { params: Promise<{ elementId: string }>; searchParams: Promise<{ businessUnitId?: string }> }) {
  const route = await params
  const search = await searchParams
  const [detailResult, elementsResult] = await Promise.all([
    getElementDetail(route.elementId, search.businessUnitId ?? null),
    listElements(search.businessUnitId ?? null),
  ])
  if (detailResult.error || !detailResult.data) return <div className="error-panel">{detailResult.error ?? 'Element not found.'}</div>
  return <ElementDetailShell detail={{ ...detailResult.data, allElements: elementsResult.data ?? [] }} section="data-points" selectedBusinessUnitId={search.businessUnitId ?? null} />
}
