import 'server-only'

import { createClient as createServerClient } from '@/lib/supabase.server'
import { createAdminClient } from '@/lib/supabase/adminClient'

export class AuthGuardError extends Error {
  code: string

  constructor(message: string, code = 'FORBIDDEN') {
    super(message)
    this.name = 'AuthGuardError'
    this.code = code
  }
}

export interface AdminCurrentUser {
  id: string
  org_id: string | null
  factory_id: string | null
  role_id: string | null
  profile_id: string | null
  first_name: string
  last_name: string | null
  email: string
  is_active: boolean | null
  is_superadmin: boolean | null
  role?: any
  profile?: any
}

export interface EffectivePermission {
  module_key: string
  module_id: string
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
  can_export: boolean
  can_approve: boolean
}

function mergePermission(target: EffectivePermission, source: Partial<EffectivePermission>) {
  // Effective permissions follow Salesforce-style additive access:
  // profile permissions are the baseline, and permission sets can only grant
  // additional capabilities. They never revoke access already granted by the profile.
  target.can_view = target.can_view || Boolean(source.can_view)
  target.can_create = target.can_create || Boolean(source.can_create)
  target.can_edit = target.can_edit || Boolean(source.can_edit)
  target.can_delete = target.can_delete || Boolean(source.can_delete)
  target.can_export = target.can_export || Boolean(source.can_export)
  target.can_approve = target.can_approve || Boolean(source.can_approve)
}

export async function getCurrentUser(): Promise<AdminCurrentUser> {
  const sessionClient = await createServerClient()
  const {
    data: { user },
    error: sessionError,
  } = await sessionClient.auth.getUser()

  if (sessionError || !user) {
    throw new AuthGuardError('You must be signed in.', 'UNAUTHENTICATED')
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .select('*, role:roles(*), profile:profiles(*)')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new AuthGuardError(error.message)
  if (!data) throw new AuthGuardError('No application user exists for this login.')
  if (data.is_active === false) throw new AuthGuardError('This user is inactive.')

  return data as AdminCurrentUser
}

export async function requireSuperadmin(): Promise<AdminCurrentUser> {
  const user = await getCurrentUser()
  const roleName = String(user.role?.name ?? '').toLowerCase()

  if (user.is_superadmin !== true && roleName !== 'superadmin') {
    throw new AuthGuardError('Only superadmin can perform this action.', 'SUPERADMIN_REQUIRED')
  }

  return user
}

export async function requireOrgAdmin(): Promise<AdminCurrentUser> {
  const user = await getCurrentUser()
  const roleName = String(user.role?.name ?? '').toLowerCase()

  if (user.is_superadmin === true || ['superadmin', 'owner', 'admin'].includes(roleName)) {
    return user
  }

  throw new AuthGuardError('Only owner, admin, or superadmin can perform this action.', 'ORG_ADMIN_REQUIRED')
}

export async function getEffectivePermissions(userId: string): Promise<Record<string, EffectivePermission>> {
  const admin = createAdminClient()
  const { data: user, error: userError } = await admin
    .from('users')
    .select('id, profile_id, is_superadmin')
    .eq('id', userId)
    .maybeSingle()

  if (userError) throw new AuthGuardError(userError.message)
  if (!user) throw new AuthGuardError('User not found.')

  const { data: modules, error: moduleError } = await admin
    .from('modules')
    .select('id, key')
    .eq('is_active', true)

  if (moduleError) throw new AuthGuardError(moduleError.message)

  const effective: Record<string, EffectivePermission> = {}
  ;(modules ?? []).forEach((moduleRow: any) => {
    effective[moduleRow.key] = {
      module_key: moduleRow.key,
      module_id: moduleRow.id,
      can_view: user.is_superadmin === true,
      can_create: user.is_superadmin === true,
      can_edit: user.is_superadmin === true,
      can_delete: user.is_superadmin === true,
      can_export: user.is_superadmin === true,
      can_approve: user.is_superadmin === true,
    }
  })

  if (user.is_superadmin === true) return effective

  if (user.profile_id) {
    const { data: profilePermissions, error } = await admin
      .from('profile_permissions')
      .select('*, modules(id, key)')
      .eq('profile_id', user.profile_id)
    if (error) throw new AuthGuardError(error.message)

    ;(profilePermissions ?? []).forEach((permission: any) => {
      const key = permission.modules?.key
      if (key && effective[key]) mergePermission(effective[key], permission)
    })
  }

  const { data: permissionSets, error: setError } = await admin
    .from('user_permission_sets')
    .select('permission_set_id')
    .eq('user_id', userId)

  if (setError) throw new AuthGuardError(setError.message)

  const setIds = (permissionSets ?? []).map((row: any) => row.permission_set_id)
  if (setIds.length) {
    const { data: setPermissions, error } = await admin
      .from('permission_set_permissions')
      .select('*, modules(id, key)')
      .in('permission_set_id', setIds)
    if (error) throw new AuthGuardError(error.message)

    ;(setPermissions ?? []).forEach((permission: any) => {
      const key = permission.modules?.key
      if (key && effective[key]) mergePermission(effective[key], permission)
    })
  }

  return effective
}
