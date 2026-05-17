import { compileElementMetadata, getElementDetail } from '@/app/actions/systemSetup/elementEngine'
import DataGridRenderer from '@/components/flare/DataGridRenderer'
import ElementPageRenderer from '@/components/flare/ElementPageRenderer'

function buildPreviewSections(compiled: any) {
  const layoutSections = compiled?.screen_design?.sections
  if (Array.isArray(layoutSections) && layoutSections.length) return layoutSections
  return [
    {
      id: 'auto_section',
      title: 'Auto Layout',
      fields: (compiled?.data_points ?? []).slice(0, 8).map((point: any) => ({
        id: point.api_name,
        label: point.label,
        required: point.is_required,
        readOnly: point.is_readonly,
      })),
    },
  ]
}

export default async function ElementPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ elementId: string }>
  searchParams: Promise<{ businessUnitId?: string }>
}) {
  const route = await params
  const search = await searchParams
  const detail = await getElementDetail(route.elementId, search.businessUnitId ?? null)
  if (detail.error || !detail.data) return <div className="error-panel">{detail.error ?? 'Element not found.'}</div>

  const compiled = await compileElementMetadata({ elementApiName: detail.data.element.api_name, business_unit_id: search.businessUnitId ?? null })
  if (compiled.error || !compiled.data) return <div className="error-panel">{compiled.error ?? 'Failed to compile metadata.'}</div>

  const columns = (compiled.data.data_points ?? []).slice(0, 6).map((point: any) => ({
    key: point.api_name,
    label: point.label,
  }))

  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <ElementPageRenderer elementLabel={compiled.data.element.label} sections={buildPreviewSections(compiled.data)} />
      <DataGridRenderer title={`${compiled.data.element.label} Data Grid`} columns={columns} rows={[]} />
    </div>
  )
}
