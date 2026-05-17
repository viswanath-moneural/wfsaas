'use server'

import { createClient as createSessionClient } from '@/lib/supabase.server'
import { isPrivilegedRole } from '@/lib/auth/isPrivilegedRole'
import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'

export type SystemSetupStateResult =
  | {
      ok: true
      userId: string
      email: string | null
      fullName: string | null
      role: string | null
      isSuperadmin: boolean
      hasOrg: boolean
      hasBusinessUnit: boolean
    }
  | { ok: false; message: string; code?: string }

export type BootstrapSystemSetupResult =
  | { ok: true; orgId: string; businessUnitId: string }
  | { ok: false; message: string; code?: string }

async function getSystemSetupCaller() {
  const sessionClient = await createSessionClient()
  const {
    data: { user },
    error: userError,
  } = await sessionClient.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, message: 'You must be signed in.', code: 'UNAUTHENTICATED' }
  }

  const admin = getSupabaseAdminClient()
  const { data: appUser, error: appUserError } = await admin
    .from('users')
    .select('id, email, full_name, role, org_id, business_unit_id, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (appUserError || !appUser || appUser.is_active === false) {
    return { ok: false as const, message: 'Your application user profile is not active.', code: 'FORBIDDEN' }
  }

  const { data: roleRows, error: roleError } = await admin
    .from('user_roles')
    .select('roles(role_name)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (roleError) {
    return { ok: false as const, message: roleError.message, code: 'ROLE_LOOKUP_FAILED' }
  }

  const roleNames = [
    String(appUser.role ?? '').toLowerCase(),
    ...((roleRows ?? []).map((row: any) => String(row.roles?.role_name ?? '').toLowerCase())),
  ]

  return {
    ok: true as const,
    user,
    appUser,
    roleNames,
    isSuperadmin: roleNames.includes('superadmin'),
    isPrivileged: roleNames.some(isPrivilegedRole),
  }
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function getSystemSetupState(): Promise<SystemSetupStateResult> {
  const caller = await getSystemSetupCaller()
  if (!caller.ok) return caller

  return {
    ok: true,
    userId: caller.user.id,
    email: caller.appUser.email ?? caller.user.email ?? null,
    fullName: caller.appUser.full_name ?? null,
    role: caller.appUser.role ?? null,
    isSuperadmin: caller.isSuperadmin,
    hasOrg: Boolean(caller.appUser.org_id),
    hasBusinessUnit: Boolean(caller.appUser.business_unit_id),
  }
}

export async function bootstrapSystemSetup(input: {
  organisationName: string
  organisationSlug: string
  country?: string | null
  timezone?: string | null
  businessUnitName: string
  businessUnitPhone?: string | null
  businessUnitAddress?: string | null
}): Promise<BootstrapSystemSetupResult> {
  const caller = await getSystemSetupCaller()
  if (!caller.ok) return caller
  if (!caller.isSuperadmin) {
    return { ok: false, message: 'Contact your administrator to assign an organisation and Business Unit.', code: 'SUPERADMIN_REQUIRED' }
  }

  const organisationName = input.organisationName.trim()
  const organisationSlug = normalizeSlug(input.organisationSlug)
  const businessUnitName = input.businessUnitName.trim()

  if (!organisationName || !organisationSlug || !businessUnitName) {
    return { ok: false, message: 'Organisation name, slug, and Business Unit name are required.', code: 'VALIDATION_ERROR' }
  }

  const admin = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data: org, error: orgError } = await admin
    .from('organisations')
    .insert({
      name: organisationName,
      slug: organisationSlug,
      country: input.country?.trim() || 'India',
      timezone: input.timezone?.trim() || 'Asia/Kolkata',
      is_active: true,
      created_at: now,
      created_by: caller.user.id,
    })
    .select('id')
    .single()

  if (orgError || !org?.id) {
    return { ok: false, message: orgError?.message ?? 'Failed to create organisation.', code: 'ORG_CREATE_FAILED' }
  }

  const { data: businessUnit, error: businessUnitError } = await admin
    .from('business_units')
    .insert({
      org_id: org.id,
      name: businessUnitName,
      phone: input.businessUnitPhone?.trim() || null,
      address: input.businessUnitAddress?.trim() || null,
      is_active: true,
      created_at: now,
      created_by: caller.user.id,
    })
    .select('id')
    .single()

  if (businessUnitError || !businessUnit?.id) {
    await admin.from('organisations').delete().eq('id', org.id)
    return { ok: false, message: businessUnitError?.message ?? 'Failed to create Business Unit.', code: 'BUSINESS_UNIT_CREATE_FAILED' }
  }

  const { error: updateError } = await admin
    .from('users')
    .update({
      org_id: org.id,
      business_unit_id: businessUnit.id,
      updated_at: now,
      last_modified_at: now,
      last_modified_by: caller.user.id,
    })
    .eq('id', caller.user.id)

  if (updateError) {
    await admin.from('business_units').delete().eq('id', businessUnit.id)
    await admin.from('organisations').delete().eq('id', org.id)
    return { ok: false, message: updateError.message, code: 'USER_ASSIGN_FAILED' }
  }

  return { ok: true, orgId: org.id, businessUnitId: businessUnit.id }
}










