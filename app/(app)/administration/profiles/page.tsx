import { adminProfiles, adminUsers } from '@/app/actions/admin'
import ProfilesAdminClient from './ProfilesAdminClient'

export default async function AdministrationProfilesPage() {
  const [profilesResult, usersResult, lookupsResult] = await Promise.all([
    adminProfiles.getAll(),
    adminUsers.getAll(),
    adminProfiles.getLookups(),
  ])

  const userCounts = (usersResult.data ?? []).reduce((counts: Record<string, number>, user: any) => {
    if (user.profile_id) counts[user.profile_id] = (counts[user.profile_id] ?? 0) + 1
    return counts
  }, {})

  return (
    <>
      {(profilesResult.error || usersResult.error || lookupsResult.error) && (
        <div className="error-panel">{profilesResult.error ?? usersResult.error ?? lookupsResult.error}</div>
      )}
      <ProfilesAdminClient
        initialProfiles={profilesResult.data ?? []}
        userCounts={userCounts}
        lookups={lookupsResult.data ?? { currentUser: null, organisations: [], modules: [] }}
      />
    </>
  )
}





