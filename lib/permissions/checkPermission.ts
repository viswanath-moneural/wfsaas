import { hasModuleAccess, type Action, type UserPermissions } from '@/lib/permissions'
import type { CurrentUserContext } from '@/lib/auth'

export function checkPermission(
  contextOrPermissions: CurrentUserContext | UserPermissions | null | undefined,
  moduleKey: string,
  action: Action = 'read'
) {
  if (!contextOrPermissions) return false

  const permissions = 'permissions' in contextOrPermissions
    ? contextOrPermissions.permissions
    : contextOrPermissions

  return hasModuleAccess(permissions, moduleKey, action)
}

export function permissionDeniedResult(action: Action, moduleKey: string) {
  return {
    ok: false as const,
    message: `You do not have permission to ${action} ${moduleKey} records.`,
    code: 'PERMISSION_DENIED',
  }
}
