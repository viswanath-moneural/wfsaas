import ElementsManagerClient from './ElementsManagerClient'
import { listElements } from '@/app/actions/systemSetup/elementEngine'

export default async function SystemSetupElementsPage() {
  const result = await listElements()
  if (result.error) {
    return <div className="error-panel">{result.error}</div>
  }
  return <ElementsManagerClient initialElements={result.data ?? []} />
}
