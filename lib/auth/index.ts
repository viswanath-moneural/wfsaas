import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase.server'
import type { UserPermissions } from '@/lib/permissions'
import { isPrivilegedRole } from './isPrivilegedRole'

export interface CurrentUserContext {
  userId: string
  email: string | null
  fullName: string | null
  orgId: string
  businessUnitId: string | null
  roleName: string
  isAdmin: boolean
  isSuperadmin: boolean
  enabledModules: string[]
  permissions: UserPermissions
}

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: appUser, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, org_id, business_unit_id, role, is_active')
    .eq('id', user.id)
    .single()

  if (userError || !appUser || appUser.is_active === false) return null

  const { data: modulesData } = await supabase
    .from('org_modules')
    .select('module_key, is_enabled')
    .eq('org_id', appUser.org_id)

  const enabledModules = (modulesData ?? [])
    .filter((moduleRow: any) => moduleRow.is_enabled)
    .map((moduleRow: any) => moduleRow.module_key)

  for (const alwaysOnModule of ['dashboard', 'configuration']) {
    if (!enabledModules.includes(alwaysOnModule)) enabledModules.push(alwaysOnModule)
  }

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id, roles(role_name, is_system)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const firstRole = userRoles?.[0] as any
  const roleId = firstRole?.role_id ?? null
  const roleName = firstRole?.roles?.role_name ?? appUser.role ?? 'operator'
  const roleNames = [
    appUser.role,
    ...((userRoles ?? []).map((row: any) => row.roles?.role_name)),
  ]
  const isSuperadmin = roleNames.some((role) => String(role ?? '').trim().toLowerCase() === 'superadmin')
  const isAdmin = roleNames.some(isPrivilegedRole)

  const { data: rolePermissions } = roleId
    ? await supabase
        .from('role_permissions')
        .select('module_key, can_create, can_read, can_update, can_delete')
        .eq('role_id', roleId)
    : { data: [] }

  const { data: fieldPermissions } = roleId
    ? await supabase
        .from('field_permissions')
        .select('table_name, field_name, can_view, can_edit')
        .eq('role_id', roleId)
    : { data: [] }

  const modulePermissions: UserPermissions['module_permissions'] = {}
  ;(rolePermissions ?? []).forEach((permission: any) => {
    modulePermissions[permission.module_key] = permission
  })

  return {
    userId: user.id,
    email: appUser.email ?? user.email ?? null,
    fullName: appUser.full_name ?? null,
    orgId: appUser.org_id,
    businessUnitId: appUser.business_unit_id,
    roleName,
    isAdmin,
    isSuperadmin,
    enabledModules,
    permissions: {
      role_name: roleName,
      is_admin: isAdmin,
      module_permissions: modulePermissions,
      field_permissions: fieldPermissions ?? [],
      enabled_modules: enabledModules,
    },
  }
}

export async function requireCurrentUserContext() {
  const context = await getCurrentUserContext()
  if (!context) redirect('/login')
  return context
}





