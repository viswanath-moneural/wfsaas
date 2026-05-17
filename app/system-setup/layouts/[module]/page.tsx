import LayoutEditorClient from './LayoutEditorClient'
import { getLayoutEditorData } from '@/app/actions/systemSetup/layouts'

export default async function SystemSetupLayoutEditorPage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ businessUnitId?: string }> }) {
  const { module } = await params
  const { businessUnitId } = await searchParams
  const result = await getLayoutEditorData(module, businessUnitId)

  if (result.error || !result.data) {
    return <div className="error-panel">{result.error ?? 'Layout module not found.'}</div>
  }

  return <LayoutEditorClient data={result.data} />
}
