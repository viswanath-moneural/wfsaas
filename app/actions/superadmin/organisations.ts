'use server'

import { getSuperadminContext } from '@/lib/auth/getSuperadminContext'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'
import { createAdminClient } from '@/lib/supabase/adminClient'
import { fail, nowIso, ok, trimOrNull, writeAuditLog, type SuperadminActionResult } from './_shared'
import { MODULE_REGISTRY } from '@/lib/modules'

export async function listAll(): Promise<SuperadminActionResult<any[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data, error } = await admin.from('organisations').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function listWithMetrics(): Promise<SuperadminActionResult<any[]>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const [{ data: organisations, error }, { data: factories }, { data: users }, { data: subscriptions }] = await Promise.all([
      admin.from('organisations').select('*').order('created_at', { ascending: false }),
      admin.from('tenants').select('id, org_id'),
      admin.from('users').select('id, org_id'),
      admin.from('org_subscriptions').select('org_id, subscription_plans(plan_code, plan_name), status'),
    ])

    if (error) throw error

    const factoryCounts = new Map<string, number>()
    ;(factories ?? []).forEach((factory: any) => factoryCounts.set(factory.org_id, (factoryCounts.get(factory.org_id) ?? 0) + 1))

    const userCounts = new Map<string, number>()
    ;(users ?? []).forEach((user: any) => userCounts.set(user.org_id, (userCounts.get(user.org_id) ?? 0) + 1))

    const plans = new Map<string, string>()
    ;(subscriptions ?? []).forEach((subscription: any) => {
      plans.set(subscription.org_id, subscription.subscription_plans?.plan_name ?? subscription.subscription_plans?.plan_code ?? 'Free')
    })

    return ok((organisations ?? []).map((organisation: any) => ({
      ...organisation,
      plan: plans.get(organisation.id) ?? 'Free',
      factory_count: factoryCounts.get(organisation.id) ?? 0,
      user_count: userCounts.get(organisation.id) ?? 0,
    })))
  } catch (error) {
    return fail(error)
  }
}

async function ensurePlan(admin: ReturnType<typeof createAdminClient>, plan: string, actorId: string) {
  const planCode = plan.trim().toLowerCase()
  const { data: existing, error: existingError } = await admin
    .from('subscription_plans')
    .select('id')
    .eq('plan_code', planCode)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.id) return existing.id

  const { data, error } = await admin
    .from('subscription_plans')
    .insert({
      plan_code: planCode,
      plan_name: plan.trim(),
      description: `${plan.trim()} platform plan`,
      monthly_price: 0,
      annual_price: 0,
      max_tenants: planCode === 'enterprise' ? 999 : planCode === 'pro' ? 10 : 1,
      max_operators: planCode === 'enterprise' ? 9999 : planCode === 'pro' ? 100 : 10,
      max_messages: planCode === 'enterprise' ? 999999 : planCode === 'pro' ? 10000 : 1000,
      features: {},
      is_active: true,
      created_at: nowIso(),
      created_by: actorId,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function createWithSetup(input: {
  name: string
  slug: string
  plan: 'Free' | 'Pro' | 'Enterprise'
  adminEmail: string
  adminName: string
  adminPassword: string
}): Promise<SuperadminActionResult<{ organisationId: string; factoryId: string; adminUserId: string }>> {
  const created: { orgId?: string; factoryId?: string; authUserId?: string; roleId?: string; subscriptionId?: string } = {}
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const timestamp = nowIso()
    const name = input.name.trim()
    const slug = input.slug.trim().toLowerCase()
    const adminEmail = input.adminEmail.trim().toLowerCase()
    const adminName = input.adminName.trim()

    if (!name || !slug || !adminEmail || !adminName || !input.adminPassword) {
      throw new Error('Organisation, slug, admin email, admin name, and admin password are required.')
    }

    const { data: organisation, error: orgError } = await admin
      .from('organisations')
      .insert({
        name,
        slug,
        country: 'India',
        timezone: 'Asia/Kolkata',
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp,
        created_by: verified.userId,
      })
      .select('*')
      .single()
    if (orgError) throw orgError
    created.orgId = organisation.id

    const planId = await ensurePlan(admin, input.plan, verified.userId)
    const { data: subscription, error: subscriptionError } = await admin
      .from('org_subscriptions')
      .insert({
        org_id: organisation.id,
        plan_id: planId,
        status: 'active',
        current_period_start: timestamp,
        current_period_end: null,
        created_at: timestamp,
        updated_at: timestamp,
        created_by: verified.userId,
      })
      .select('id')
      .single()
    if (subscriptionError) throw subscriptionError
    created.subscriptionId = subscription.id

    const { data: factory, error: factoryError } = await admin
      .from('tenants')
      .insert({
        org_id: organisation.id,
        name: `${name} - Primary Factory`,
        is_active: true,
        created_at: timestamp,
        created_by: verified.userId,
      })
      .select('id')
      .single()
    if (factoryError) throw factoryError
    created.factoryId = factory.id

    const { data: role, error: roleError } = await admin
      .from('roles')
      .insert({
        org_id: organisation.id,
        role_name: 'owner',
        description: 'Organisation owner',
        is_system: true,
        created_at: timestamp,
        created_by: verified.userId,
      })
      .select('id')
      .single()
    if (roleError) throw roleError
    created.roleId = role.id

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: input.adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminName },
    })
    if (authError || !authData.user) throw authError ?? new Error('Failed to create organisation admin login.')
    created.authUserId = authData.user.id

    const { error: appUserError } = await admin.from('users').insert({
      id: authData.user.id,
      org_id: organisation.id,
      tenant_id: factory.id,
      full_name: adminName,
      phone: '0000000000',
      role: 'owner',
      is_active: true,
      email: adminEmail,
      created_at: timestamp,
      updated_at: timestamp,
      created_by: verified.userId,
    })
    if (appUserError) throw appUserError

    const { error: userRoleError } = await admin.from('user_roles').insert({
      user_id: authData.user.id,
      role_id: role.id,
      assigned_by: verified.userId,
      assigned_at: timestamp,
      is_active: true,
      created_at: timestamp,
      created_by: verified.userId,
    })
    if (userRoleError) throw userRoleError

    const moduleRows = Object.values(MODULE_REGISTRY).map((moduleItem) => ({
      org_id: organisation.id,
      module_key: moduleItem.key,
      is_enabled: moduleItem.alwaysOn || ['sales', 'purchases', 'inventory', 'configuration'].includes(moduleItem.key),
      config: {},
      created_at: timestamp,
      created_by: verified.userId,
    }))
    const { error: moduleError } = await admin.from('org_modules').insert(moduleRows)
    if (moduleError) throw moduleError

    await writeAuditLog({
      admin,
      actor: verified,
      orgId: organisation.id,
      tableName: 'organisations',
      recordId: organisation.id,
      action: 'create_with_setup',
      newData: { organisation, factory_id: factory.id, admin_user_id: authData.user.id, plan: input.plan },
    })

    return ok({ organisationId: organisation.id, factoryId: factory.id, adminUserId: authData.user.id })
  } catch (error) {
    const admin = createAdminClient()
    if (created.authUserId) await admin.auth.admin.deleteUser(created.authUserId)
    if (created.orgId) await admin.from('organisations').delete().eq('id', created.orgId)
    return fail(error)
  }
}

export async function getDetails(id: string): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const [
      { data: organisation, error: orgError },
      { data: factories },
      { data: users },
      { data: modules },
      { data: auditLog },
      { data: subscription },
    ] = await Promise.all([
      admin.from('organisations').select('*').eq('id', id).single(),
      admin.from('tenants').select('*').eq('org_id', id).order('created_at', { ascending: false }),
      admin.from('users').select('*, user_roles(role_id, roles(role_name))').eq('org_id', id).order('created_at', { ascending: false }),
      admin.from('org_modules').select('*').eq('org_id', id).order('module_key'),
      admin.from('audit_log').select('*').eq('org_id', id).order('changed_at', { ascending: false }).limit(50),
      admin.from('org_subscriptions').select('*, subscription_plans(plan_code, plan_name)').eq('org_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (orgError) throw orgError
    return ok({
      organisation: { ...organisation, plan: (subscription as any)?.subscription_plans?.plan_name ?? 'Free' },
      factories: factories ?? [],
      users: users ?? [],
      modules: modules ?? [],
      auditLog: auditLog ?? [],
      subscription,
    })
  } catch (error) {
    return fail(error)
  }
}

export async function create(input: {
  name: string
  slug: string
  country?: string | null
  timezone?: string | null
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const timestamp = nowIso()
    const payload = {
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      country: trimOrNull(input.country),
      timezone: trimOrNull(input.timezone),
      is_active: true,
      created_at: timestamp,
      created_by: verified.userId,
    }

    if (!payload.name || !payload.slug) throw new Error('Organisation name and slug are required.')

    const { data, error } = await admin.from('organisations').insert(payload).select('*').single()
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: data.id, tableName: 'organisations', recordId: data.id, action: 'create', newData: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function update(id: string, input: {
  name?: string
  slug?: string
  country?: string | null
  timezone?: string | null
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('organisations').select('*').eq('id', id).single()
    if (lookupError) throw lookupError

    const payload = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug !== undefined ? { slug: input.slug.trim().toLowerCase() } : {}),
      ...(input.country !== undefined ? { country: trimOrNull(input.country) } : {}),
      ...(input.timezone !== undefined ? { timezone: trimOrNull(input.timezone) } : {}),
      updated_at: nowIso(),
      last_modified_at: nowIso(),
      last_modified_by: verified.userId,
    }

    const { data, error } = await admin.from('organisations').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: id, tableName: 'organisations', recordId: id, action: 'update', oldData, newData: data })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function updateDetails(id: string, input: {
  name?: string
  slug?: string
  plan?: 'Free' | 'Pro' | 'Enterprise'
}): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('organisations').select('*').eq('id', id).single()
    if (lookupError) throw lookupError

    const payload = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug !== undefined ? { slug: input.slug.trim().toLowerCase() } : {}),
      updated_at: nowIso(),
      last_modified_at: nowIso(),
      last_modified_by: verified.userId,
    }

    const { data, error } = await admin.from('organisations').update(payload).eq('id', id).select('*').single()
    if (error) throw error

    if (input.plan) {
      const planId = await ensurePlan(admin, input.plan, verified.userId)
      const { data: existing } = await admin
        .from('org_subscriptions')
        .select('id')
        .eq('org_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const subscriptionPayload = {
        org_id: id,
        plan_id: planId,
        status: 'active',
        updated_at: nowIso(),
        last_modified_at: nowIso(),
        last_modified_by: verified.userId,
      }

      const subscriptionResult = existing?.id
        ? await admin.from('org_subscriptions').update(subscriptionPayload).eq('id', existing.id)
        : await admin.from('org_subscriptions').insert({
            ...subscriptionPayload,
            current_period_start: nowIso(),
            current_period_end: null,
            created_at: nowIso(),
            created_by: verified.userId,
          })
      if (subscriptionResult.error) throw subscriptionResult.error
    }

    await writeAuditLog({ admin, actor: verified, orgId: id, tableName: 'organisations', recordId: id, action: 'update_details', oldData, newData: { ...data, plan: input.plan } })
    return ok({ ...data, plan: input.plan })
  } catch (error) {
    return fail(error)
  }
}

export async function deleteOrganisation(id: string): Promise<SuperadminActionResult<{ id: string }>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('organisations').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    const { error } = await admin.from('organisations').delete().eq('id', id)
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: id, tableName: 'organisations', recordId: id, action: 'delete', oldData })
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

async function setActive(id: string, isActive: boolean, action: 'suspend' | 'activate') {
  const verified = await requireSuperadmin()
  await getSuperadminContext(verified)
  const admin = createAdminClient()
  const { data: oldData, error: lookupError } = await admin.from('organisations').select('*').eq('id', id).single()
  if (lookupError) throw lookupError
  const { data, error } = await admin
    .from('organisations')
    .update({ is_active: isActive, updated_at: nowIso(), last_modified_at: nowIso(), last_modified_by: verified.userId })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  await writeAuditLog({ admin, actor: verified, orgId: id, tableName: 'organisations', recordId: id, action, oldData, newData: data })
  return data
}

export async function suspend(id: string): Promise<SuperadminActionResult<any>> {
  try {
    return ok(await setActive(id, false, 'suspend'))
  } catch (error) {
    return fail(error)
  }
}

export async function suspendWithReason(id: string, reason: string): Promise<SuperadminActionResult<any>> {
  try {
    const verified = await requireSuperadmin()
    await getSuperadminContext(verified)
    const admin = createAdminClient()
    const { data: oldData, error: lookupError } = await admin.from('organisations').select('*').eq('id', id).single()
    if (lookupError) throw lookupError
    const { data, error } = await admin
      .from('organisations')
      .update({ is_active: false, updated_at: nowIso(), last_modified_at: nowIso(), last_modified_by: verified.userId })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    await writeAuditLog({ admin, actor: verified, orgId: id, tableName: 'organisations', recordId: id, action: 'suspend', oldData, newData: { ...data, suspension_reason: reason } })
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function activate(id: string): Promise<SuperadminActionResult<any>> {
  try {
    return ok(await setActive(id, true, 'activate'))
  } catch (error) {
    return fail(error)
  }
}
