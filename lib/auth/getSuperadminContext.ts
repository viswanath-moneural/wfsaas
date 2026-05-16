import 'server-only'

import { createAdminClient } from '@/lib/supabase/adminClient'
import { requireSuperadmin, type VerifiedSuperadmin } from './requireSuperadmin'

export interface SuperadminContext {
  user: VerifiedSuperadmin
  isSuperadmin: true
  orgId: string | null
  permissions: any[]
}

export async function getSuperadminContext(verified?: VerifiedSuperadmin): Promise<SuperadminContext> {
  const user = verified ?? await requireSuperadmin()
  const admin = createAdminClient()

  const { data: permissions } = user.roleIds.length
    ? await admin
        .from('permissions')
        .select('*')
        .in('role_id', user.roleIds)
    : { data: [] }

  return {
    user,
    isSuperadmin: true,
    orgId: user.orgId,
    permissions: permissions ?? [],
  }
}
