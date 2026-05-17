import ModuleManagerClient from '@/app/system-setup/modules/ModuleManagerClient'
import { getModuleManagerData } from '@/app/actions/systemSetup/modules'

export default async function SystemSetupModulesPage() {
  const result = await getModuleManagerData()
  if (result.error || !result.data) return <p>{result.error ?? 'Failed to load module manager.'}</p>

  return (
    <section>
      <h1>Module Manager</h1>
      <p>Choose how you want to view and configure your modules.</p>
      <ModuleManagerClient initialData={result.data} mode="landing" />
    </section>
  )
}
