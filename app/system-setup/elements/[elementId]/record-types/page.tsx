import { getElementDetail, listElements } from '@/app/actions/systemSetup/elementEngine'
import ElementDetailShell from '../ElementDetailShell'

export default async function ElementRecordTypesPage({ params }: { params: Promise<{ elementId: string }> }) {
  const route = await params
  const [detailResult, elementsResult] = await Promise.all([
    getElementDetail(route.elementId),
    listElements(),
  ])
  if (detailResult.error || !detailResult.data) return <div className="error-panel">{detailResult.error ?? 'Element not found.'}</div>
  return <ElementDetailShell detail={{ ...detailResult.data, allElements: elementsResult.data ?? [] }} section="record-types" />
}
