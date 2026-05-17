'use server'

import { createClient as createSessionClient } from '@/lib/supabase.server'
import { isPrivilegedRole } from '@/lib/auth/isPrivilegedRole'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'

export interface CreateUserInput {
  name: string
  email: string
  temporaryPassword: string
  org_id: string
  business_unit_id?: string | null
  role_id: string
}

export type CreateUserResult =
  | { ok: true; userId: string }
  | { ok: false; message: string; code?: string }

function cleanEmail(email: string) {
  return email.trim().toLowerCase()
}

function validateInput(input: CreateUserInput): CreateUserResult | null {
  if (!input.name?.trim()) return { ok: false, message: 'Full name is required.', code: 'VALIDATION_ERROR' }
  if (!input.email?.trim()) return { ok: false, message: 'Email is required.', code: 'VALIDATION_ERROR' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(input.email))) {
    return { ok: false, message: 'Enter a valid email address.', code: 'VALIDATION_ERROR' }
  }
  if (!input.temporaryPassword?.trim()) {
    return { ok: false, message: 'Temporary password is required.', code: 'VALIDATION_ERROR' }
  }
  if (input.temporaryPassword.length < 6) {
    return { ok: false, message: 'Temporary password must be at least 6 characters.', code: 'VALIDATION_ERROR' }
  }
  if (!input.org_id) return { ok: false, message: 'Organisation is required.', code: 'VALIDATION_ERROR' }
  if (!input.role_id) return { ok: false, message: 'Role is required.', code: 'VALIDATION_ERROR' }
  return null
}

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const validationError = validateInput(input)
  if (validationError) return validationError

  const email = cleanEmail(input.email)
  const name = input.name.trim()
  const businessUnitId = input.business_unit_id || null

  let authUserId: string | null = null

  try {
    const sessionClient = await createSessionClient()
    const {
      data: { user: caller },
      error: callerError,
    } = await sessionClient.auth.getUser()

    if (callerError || !caller) {
      return { ok: false, message: 'You must be signed in to create users.', code: 'UNAUTHENTICATED' }
    }

    const supabaseAdmin = getSupabaseAdminClient()

    const { data: callerAppUser, error: callerAppUserError } = await supabaseAdmin
      .from('users')
      .select('id, org_id, role, is_active')
      .eq('id', caller.id)
      .maybeSingle()

    if (callerAppUserError || !callerAppUser || callerAppUser.is_active === false) {
      return { ok: false, message: 'Your application user profile is not active.', code: 'FORBIDDEN' }
    }

    const { data: callerRoles, error: callerRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('roles(role_name)')
      .eq('user_id', caller.id)
      .eq('is_active', true)

    if (callerRolesError) {
      return { ok: false, message: callerRolesError.message, code: 'ROLE_LOOKUP_FAILED' }
    }

    const callerRoleNames = new Set<string>([
      String(callerAppUser.role ?? '').toLowerCase(),
      ...((callerRoles ?? []).map((row: any) => String(row.roles?.role_name ?? '').toLowerCase())),
    ])
    const isSuperadmin = callerRoleNames.has('superadmin')
    const isAllowedAdmin = Array.from(callerRoleNames).some(isPrivilegedRole)

    if (!isAllowedAdmin) {
      return { ok: false, message: 'You do not have permission to create users.', code: 'FORBIDDEN' }
    }

    if (!isSuperadmin && callerAppUser.org_id !== input.org_id) {
      return { ok: false, message: 'You can only create users inside your organisation.', code: 'FORBIDDEN' }
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organisations')
      .select('id')
      .eq('id', input.org_id)
      .maybeSingle()

    if (orgError || !org) {
      return { ok: false, message: 'Selected organisation was not found.', code: 'ORG_NOT_FOUND' }
    }

    if (businessUnitId) {
      const { data: businessUnit, error: businessUnitError } = await supabaseAdmin
        .from('business_units')
        .select('id')
        .eq('id', businessUnitId)
        .eq('org_id', input.org_id)
        .maybeSingle()

      if (businessUnitError || !businessUnit) {
        return { ok: false, message: 'Selected Business Unit does not belong to this organisation.', code: 'BUSINESS_UNIT_NOT_FOUND' }
      }
    }

    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .select('id, org_id, role_name')
      .eq('id', input.role_id)
      .eq('org_id', input.org_id)
      .maybeSingle()

    if (roleError || !role) {
      return { ok: false, message: 'Selected role does not belong to this organisation.', code: 'ROLE_NOT_FOUND' }
    }

    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: input.temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: name,
      },
    })

    if (authCreateError || !authData.user?.id) {
      return {
        ok: false,
        message: authCreateError?.message ?? 'Failed to create Supabase Auth user.',
        code: 'AUTH_CREATE_FAILED',
      }
    }

    authUserId = authData.user.id

    const { error: appUserInsertError } = await supabaseAdmin.from('users').insert({
      id: authUserId,
      org_id: input.org_id,
      business_unit_id: businessUnitId,
      full_name: name,
      email,
      phone: '0000000000',
      role: role.role_name,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: caller.id,
    })

    if (appUserInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
      return { ok: false, message: appUserInsertError.message, code: 'APP_USER_CREATE_FAILED' }
    }

    const { error: roleAssignError } = await supabaseAdmin.from('user_roles').insert({
      user_id: authUserId,
      role_id: input.role_id,
      assigned_by: caller.id,
      assigned_at: new Date().toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
      created_by: caller.id,
    })

    if (roleAssignError) {
      await supabaseAdmin.from('users').delete().eq('id', authUserId)
      await supabaseAdmin.auth.admin.deleteUser(authUserId)
      return { ok: false, message: roleAssignError.message, code: 'ROLE_ASSIGN_FAILED' }
    }

    return { ok: true, userId: authUserId }
  } catch (error) {
    if (authUserId) {
      try {
        const supabaseAdmin = getSupabaseAdminClient()
        await supabaseAdmin.from('users').delete().eq('id', authUserId)
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
      } catch {
        // Best-effort rollback only.
      }
    }

    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Unexpected error while creating user.',
      code: 'UNEXPECTED_ERROR',
    }
  }
}









