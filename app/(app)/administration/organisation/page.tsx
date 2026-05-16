import { adminOrganisations } from '@/app/actions/admin'
import { requireOrgAdmin } from '@/lib/auth/guards'
import OrganisationAdminClient from './OrganisationAdminClient'

export default async function AdministrationOrganisationPage() {
  const actor = await requireOrgAdmin()
  const result = actor.is_superadmin
    ? await adminOrganisations.getAll()
    : actor.org_id
      ? await adminOrganisations.getById(actor.org_id)
      : { data: null, error: 'No organisation is mapped to this login.' }

  const organisations = Array.isArray(result.data) ? result.data : result.data ? [result.data] : []

  return (
    <>
      {result.error && <div className="error-panel">{result.error}</div>}
      <OrganisationAdminClient organisations={organisations} currentUser={actor} />
    </>
  )
}





