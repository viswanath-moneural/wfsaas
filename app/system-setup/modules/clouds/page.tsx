import ModuleManagerClient from '@/app/system-setup/modules/ModuleManagerClient'
import { getModuleManagerData } from '@/app/actions/systemSetup/modules'

export default async function SystemSetupCloudModulesPage() {
  const result = await getModuleManagerData()
  if (result.error || !result.data) return <p>{result.error ?? 'Failed to load clouds.'}</p>

  return (
    <section>
      <h1>Industry Clouds</h1>
      <ModuleManagerClient initialData={result.data} mode="clouds" />
    </section>
  )
}
