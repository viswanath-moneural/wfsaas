import ModuleManagerClient from '@/app/system-setup/modules/ModuleManagerClient'
import { getModuleManagerData } from '@/app/actions/systemSetup/modules'

export default async function SystemSetupAppModulesPage() {
  const result = await getModuleManagerData()
  if (result.error || !result.data) return <p>{result.error ?? 'Failed to load apps.'}</p>

  return (
    <section>
      <h1>Functional Apps</h1>
      <ModuleManagerClient initialData={result.data} mode="apps" />
    </section>
  )
}
