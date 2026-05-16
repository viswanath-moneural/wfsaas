'use server'

import { getCurrentUser, getEffectivePermissions } from '@/lib/auth/guards'
import { fail, ok, type AdminActionResult } from '@/app/actions/admin/_shared'

export async function getCurrentUserPermissions(): Promise<AdminActionResult<any>> {
  try {
    const user = await getCurrentUser()
    const roleName = String(user.role?.name ?? '').toLowerCase()
    const isSuperadmin = user.is_superadmin === true || roleName === 'superadmin'
    const effective = isSuperadmin ? {} : await getEffectivePermissions(user.id)

    const permissions = isSuperadmin
      ? {}
      : Object.fromEntries(Object.entries(effective).map(([moduleKey, permission]: [string, any]) => [
          moduleKey,
          {
            canView: Boolean(permission.can_view),
            canCreate: Boolean(permission.can_create),
            canEdit: Boolean(permission.can_edit),
            canDelete: Boolean(permission.can_delete),
            canExport: Boolean(permission.can_export),
            canApprove: Boolean(permission.can_approve),
            can_view: Boolean(permission.can_view),
            can_create: Boolean(permission.can_create),
            can_edit: Boolean(permission.can_edit),
            can_delete: Boolean(permission.can_delete),
            can_export: Boolean(permission.can_export),
            can_approve: Boolean(permission.can_approve),
            can_read: Boolean(permission.can_view),
            can_update: Boolean(permission.can_edit),
          },
        ]))

    return ok({
      userId: user.id,
      roleName: user.role?.label ?? user.role?.name ?? '',
      profileName: user.profile?.label ?? user.profile?.name ?? '',
      isSuperadmin,
      permissions,
    })
  } catch (error) {
    return fail(error)
  }
}





