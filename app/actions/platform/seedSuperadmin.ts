'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/adminClient'

export type SeedSuperadminResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; message: string; code?: string }

const PLATFORM_ORG_SLUG = 'wfsaas-platform'

async function findAuthUserByEmail(email: string) {
  const admin = getSupabaseAdminClient()
  let page = 1
  const perPage = 100

  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const user = data.users.find((item) => item.email?.toLowerCase() === email)
    if (user) return user
    if (data.users.length < perPage) return null
    page += 1
  }

  return null
}

export async function seedSuperadmin(): Promise<SeedSuperadminResult> {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SUPERADMIN_PASSWORD

  if (!email || !password) {
    return { ok: false, message: 'SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required.', code: 'ENV_MISSING' }
  }

  const admin = getSupabaseAdminClient()

  try {
    const existingAuthUser = await findAuthUserByEmail(email)
    const authUser = existingAuthUser ?? (await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'WFSAAS Super Admin',
      },
    })).data.user

    if (!authUser?.id) {
      return { ok: false, message: 'Failed to create or find Supabase Auth user.', code: 'AUTH_USER_MISSING' }
    }

    const { data: org, error: orgError } = await admin
      .from('organisations')
      .select('id')
      .eq('slug', PLATFORM_ORG_SLUG)
      .maybeSingle()

    if (orgError) return { ok: false, message: orgError.message, code: 'ORG_LOOKUP_FAILED' }

    const platformOrg = org ?? (await admin
      .from('organisations')
      .insert({
        name: 'WFSAAS Platform',
        slug: PLATFORM_ORG_SLUG,
        country: 'India',
        timezone: 'Asia/Kolkata',
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: authUser.id,
      })
      .select('id')
      .single()).data

    if (!platformOrg?.id) {
      return { ok: false, message: 'Failed to create or find platform organisation.', code: 'ORG_MISSING' }
    }

    const { data: role, error: roleLookupError } = await admin
      .from('roles')
      .select('id')
      .eq('org_id', platformOrg.id)
      .eq('role_name', 'superadmin')
      .maybeSingle()

    if (roleLookupError) return { ok: false, message: roleLookupError.message, code: 'ROLE_LOOKUP_FAILED' }

    const superadminRole = role ?? (await admin
      .from('roles')
      .insert({
        org_id: platformOrg.id,
        role_name: 'superadmin',
        description: 'Platform super admin',
        is_system: true,
        created_at: new Date().toISOString(),
        created_by: authUser.id,
      })
      .select('id')
      .single()).data

    if (!superadminRole?.id) {
      return { ok: false, message: 'Failed to create or find superadmin role.', code: 'ROLE_MISSING' }
    }

    const { data: appUser } = await admin
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!appUser) {
      const { error: userInsertError } = await admin.from('users').insert({
        id: authUser.id,
        org_id: platformOrg.id,
        business_unit_id: null,
        full_name: 'WFSAAS Super Admin',
        phone: '0000000000',
        role: 'superadmin',
        is_active: true,
        email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: authUser.id,
      })

      if (userInsertError) return { ok: false, message: userInsertError.message, code: 'APP_USER_CREATE_FAILED' }
    } else {
      const { error: userUpdateError } = await admin
        .from('users')
        .update({
          org_id: platformOrg.id,
          role: 'superadmin',
          is_active: true,
          email,
          updated_at: new Date().toISOString(),
          last_modified_at: new Date().toISOString(),
          last_modified_by: authUser.id,
        })
        .eq('id', authUser.id)

      if (userUpdateError) return { ok: false, message: userUpdateError.message, code: 'APP_USER_UPDATE_FAILED' }
    }

    const { data: existingAssignment } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', authUser.id)
      .eq('role_id', superadminRole.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!existingAssignment) {
      const { error: assignmentError } = await admin.from('user_roles').insert({
        user_id: authUser.id,
        role_id: superadminRole.id,
        assigned_by: authUser.id,
        assigned_at: new Date().toISOString(),
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: authUser.id,
      })

      if (assignmentError) return { ok: false, message: assignmentError.message, code: 'ROLE_ASSIGN_FAILED' }
    }

    return { ok: true, userId: authUser.id, email }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to seed superadmin.',
      code: 'SEED_SUPERADMIN_FAILED',
    }
  }
}





