import 'server-only'

import type { User } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase.server'
import { createAdminClient } from '@/lib/supabase/adminClient'

export class UnauthorizedError extends Error {
  code = 'SUPERADMIN_REQUIRED'

  constructor(message = 'Only superadmin users can perform this action.') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export interface VerifiedSuperadmin {
  authUser: User
  appUser: {
    id: string
    org_id: string | null
    business_unit_id: string | null
    email: string | null
    full_name: string | null
    role: string | null
    is_active: boolean | null
  }
  userId: string
  orgId: string | null
  businessUnitId: string | null
  roleIds: string[]
  roleNames: string[]
}

function normalizeRole(role: unknown) {
  return String(role ?? '').trim().toLowerCase()
}

export async function requireSuperadmin(): Promise<VerifiedSuperadmin> {
  const sessionClient = await createSessionClient()
  const {
    data: { user },
    error: userError,
  } = await sessionClient.auth.getUser()

  if (userError || !user) {
    throw new UnauthorizedError('You must be signed in as a superadmin.')
  }

  const admin = createAdminClient()
  const { data: appUser, error: appUserError } = await admin
    .from('users')
    .select('id, org_id, business_unit_id, email, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (appUserError || !appUser || appUser.is_active === false) {
    throw new UnauthorizedError('Your application user profile is not active.')
  }

  const { data: roleRows, error: roleError } = await admin
    .from('user_roles')
    .select('role_id, roles(role_name, is_system)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (roleError) {
    throw new UnauthorizedError(roleError.message)
  }

  const roleIds = (roleRows ?? [])
    .map((row: any) => row.role_id)
    .filter(Boolean)

  const roleNames = [
    appUser.role,
    ...((roleRows ?? []).map((row: any) => row.roles?.role_name)),
  ]
    .map(normalizeRole)
    .filter(Boolean)

  if (!roleNames.includes('superadmin')) {
    throw new UnauthorizedError()
  }

  return {
    authUser: user,
    appUser,
    userId: user.id,
    orgId: appUser.org_id,
    businessUnitId: appUser.business_unit_id,
    roleIds,
    roleNames,
  }
}





