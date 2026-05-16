import { superadminHealth } from '@/app/actions/superadmin'
import HealthClient from './HealthClient'

export default async function HealthPage() {
  const result = await superadminHealth.runHealthChecks()

  return (
    <>
      {result.error && <div className="error-panel">{result.error}</div>}
      <HealthClient initialResults={result.data ?? []} />
    </>
  )
}





