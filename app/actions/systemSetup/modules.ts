'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase.server'
import type { AppDefinition, CloudDefinition, ModuleDefinition, ModuleManagerData } from '@/lib/moduleManager'

type ActionResult<T> = { data: T | null; error: string | null }

function ok<T>(data: T): ActionResult<T> {
  return { data, error: null }
}

function fail<T = never>(error: unknown): ActionResult<T> {
  return { data: null, error: error instanceof Error ? error.message : String(error || 'Module action failed.') }
}

async function requireSetupAdmin() {
  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('You must be signed in.')

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*, roles(role_name, name, label)')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (userError) throw userError
  if (!user || user.is_active === false) throw new Error('Your user profile is not active.')

  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('roles(role_name, name, label)')
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
  if (roleError) throw roleError

  const roleNames = [
    String(user.role ?? '').toLowerCase(),
    String(user.roles?.role_name ?? user.roles?.name ?? user.roles?.label ?? '').toLowerCase(),
    ...((roleRows ?? []).map((row: any) => String(row.roles?.role_name ?? row.roles?.name ?? row.roles?.label ?? '').toLowerCase())),
  ]
  const isSuperadmin = roleNames.includes('superadmin')
  const isAdmin = isSuperadmin || roleNames.includes('admin')
  if (!isAdmin) throw new Error('Only admins can manage modules.')
  if (!user.org_id) throw new Error('User has no organisation assigned.')

  return { supabase, user, isSuperadmin }
}

function normalizeRows(rows: Array<{ key: string; enabled: boolean; config?: any }>) {
  const map: Record<string, boolean> = {}
  const configs: Record<string, any> = {}
  for (const row of rows) {
    map[row.key] = row.enabled
    if (row.config) configs[row.key] = row.config
  }
  return { map, configs }
}

async function getDefinitions(supabase: any) {
  const [{ data: clouds, error: cloudError }, { data: apps, error: appError }, { data: modules, error: moduleError }] = await Promise.all([
    supabase.from('cloud_definitions').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('app_definitions').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('module_definitions').select('*').order('sort_order', { ascending: true }),
  ])
  if (cloudError) throw cloudError
  if (appError) throw appError
  if (moduleError) throw moduleError
  return {
    clouds: (clouds ?? []) as CloudDefinition[],
    apps: (apps ?? []) as AppDefinition[],
    modules: (modules ?? []) as ModuleDefinition[],
  }
}

async function getOrgState(supabase: any, orgId: string) {
  const [{ data: orgCloudRows, error: cloudError }, { data: orgAppRows, error: appError }, { data: orgModuleRows, error: moduleError }] = await Promise.all([
    supabase.from('org_cloud_subscriptions').select('cloud_key, is_enabled').eq('org_id', orgId),
    supabase.from('org_app_subscriptions').select('app_key, is_enabled').eq('org_id', orgId),
    supabase.from('org_modules').select('module_key, is_enabled, config').eq('org_id', orgId),
  ])
  if (cloudError) throw cloudError
  if (appError) throw appError
  if (moduleError) throw moduleError

  const cloudMap: Record<string, boolean> = {}
  const appMap: Record<string, boolean> = {}
  ;(orgCloudRows ?? []).forEach((row: any) => {
    cloudMap[row.cloud_key] = Boolean(row.is_enabled)
  })
  ;(orgAppRows ?? []).forEach((row: any) => {
    appMap[row.app_key] = Boolean(row.is_enabled)
  })
  const { map: moduleMap, configs } = normalizeRows(
    (orgModuleRows ?? []).map((row: any) => ({
      key: row.module_key,
      enabled: Boolean(row.is_enabled),
      config: row.config ?? {},
    }))
  )
  return { cloudMap, appMap, moduleMap, moduleConfigs: configs }
}

async function upsertOrgModules(
  supabase: any,
  orgId: string,
  actorId: string,
  rows: Array<{ module_key: string; is_enabled: boolean; cloud_key?: string | null; app_key?: string | null; config?: any }>
) {
  if (!rows.length) return
  const payload = rows.map((row) => ({
    org_id: orgId,
    module_key: row.module_key,
    is_enabled: row.is_enabled,
    cloud_key: row.cloud_key ?? null,
    app_key: row.app_key ?? null,
    config: row.config ?? {},
    last_modified_at: new Date().toISOString(),
    last_modified_by: actorId,
  }))
  const { error } = await supabase.from('org_modules').upsert(payload, { onConflict: 'org_id,module_key' })
  if (error) throw error
}

export async function getModuleManagerData(): Promise<ActionResult<ModuleManagerData>> {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const [{ clouds, apps, modules }, state] = await Promise.all([getDefinitions(supabase), getOrgState(supabase, user.org_id)])

    return ok({
      clouds,
      apps,
      modules,
      orgClouds: state.cloudMap,
      orgApps: state.appMap,
      orgModules: state.moduleMap,
      moduleConfigs: state.moduleConfigs,
      selectedCloudKey: clouds[0]?.cloud_key ?? '',
      selectedAppKey: apps[0]?.app_key ?? '',
    })
  } catch (error) {
    return fail(error)
  }
}

export async function syncModulePermissions(moduleKey: string, isEnabled: boolean, orgId: string): Promise<ActionResult<{ moduleKey: string; isEnabled: boolean }>> {
  try {
    const { supabase } = await requireSetupAdmin()
    const { data: roles, error: roleError } = await supabase.from('roles').select('id').eq('org_id', orgId)
    if (roleError) throw roleError
    const roleIds = (roles ?? []).map((row: any) => row.id)

    const { data: moduleRow, error: moduleError } = await supabase
      .from('org_modules')
      .select('id, config')
      .eq('org_id', orgId)
      .eq('module_key', moduleKey)
      .maybeSingle()
    if (moduleError) throw moduleError
    const config = moduleRow?.config ?? {}

    if (!isEnabled) {
      const { data: existingPermissions, error: permissionError } = await supabase
        .from('role_permissions')
        .select('role_id, can_create, can_read, can_update, can_delete')
        .eq('module_key', moduleKey)
        .in('role_id', roleIds.length ? roleIds : ['00000000-0000-0000-0000-000000000000'])
      if (permissionError) throw permissionError

      const savedPermissions: Record<string, any> = {}
      ;(existingPermissions ?? []).forEach((row: any) => {
        savedPermissions[row.role_id] = {
          can_create: Boolean(row.can_create),
          can_read: Boolean(row.can_read),
          can_update: Boolean(row.can_update),
          can_delete: Boolean(row.can_delete),
        }
      })

      if (moduleRow?.id) {
        const { error: updateModuleError } = await supabase
          .from('org_modules')
          .update({ config: { ...config, saved_permissions: savedPermissions } })
          .eq('id', moduleRow.id)
        if (updateModuleError) throw updateModuleError
      }

      if (roleIds.length) {
        const updatePayload = roleIds.map((roleId) => ({
          role_id: roleId,
          module_key: moduleKey,
          can_create: false,
          can_read: false,
          can_update: false,
          can_delete: false,
        }))
        const { error: upsertError } = await supabase.from('role_permissions').upsert(updatePayload, { onConflict: 'role_id,module_key' })
        if (upsertError) throw upsertError
      }
    } else {
      const saved = config?.saved_permissions ?? {}
      if (roleIds.length) {
        const restorePayload = roleIds.map((roleId) => {
          const prior = saved[roleId]
          return {
            role_id: roleId,
            module_key: moduleKey,
            can_create: Boolean(prior?.can_create ?? false),
            can_read: Boolean(prior?.can_read ?? true),
            can_update: Boolean(prior?.can_update ?? false),
            can_delete: Boolean(prior?.can_delete ?? false),
          }
        })
        const { error: restoreError } = await supabase.from('role_permissions').upsert(restorePayload, { onConflict: 'role_id,module_key' })
        if (restoreError) throw restoreError
      }
    }

    return ok({ moduleKey, isEnabled })
  } catch (error) {
    return fail(error)
  }
}

export async function toggleModule(moduleKey: string, enabled: boolean): Promise<ActionResult<{ moduleKey: string; enabled: boolean }>> {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const { data: moduleDef, error: definitionError } = await supabase
      .from('module_definitions')
      .select('*')
      .eq('module_key', moduleKey)
      .maybeSingle()
    if (definitionError) throw definitionError
    if (!moduleDef) throw new Error('Module not found.')
    if (moduleDef.is_core && !enabled) throw new Error('Core modules cannot be disabled.')

    await upsertOrgModules(supabase, user.org_id, user.id, [
      {
        module_key: moduleKey,
        is_enabled: enabled,
        cloud_key: moduleDef.cloud_keys?.[0] ?? null,
        app_key: moduleDef.app_keys?.[0] ?? null,
      },
    ])
    await syncModulePermissions(moduleKey, enabled, user.org_id)
    revalidatePath('/system-setup/modules')
    revalidatePath('/system-setup/modules/clouds')
    revalidatePath('/system-setup/modules/apps')
    return ok({ moduleKey, enabled })
  } catch (error) {
    return fail(error)
  }
}

export async function toggleCloud(cloudKey: string, enabled: boolean): Promise<ActionResult<{ cloudKey: string; enabled: boolean; activatedCount: number }>> {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const [{ data: modules, error: moduleError }, { data: allCloudSubs, error: cloudSubError }] = await Promise.all([
      supabase.from('module_definitions').select('*').contains('cloud_keys', [cloudKey]),
      supabase.from('org_cloud_subscriptions').select('cloud_key, is_enabled').eq('org_id', user.org_id),
    ])
    if (moduleError) throw moduleError
    if (cloudSubError) throw cloudSubError

    const cloudPayload = {
      org_id: user.org_id,
      cloud_key: cloudKey,
      is_enabled: enabled,
      enabled_at: new Date().toISOString(),
    }
    const { error: upsertCloudError } = await supabase.from('org_cloud_subscriptions').upsert(cloudPayload, { onConflict: 'org_id,cloud_key' })
    if (upsertCloudError) throw upsertCloudError

    const cloudEnabledMap: Record<string, boolean> = {}
    ;(allCloudSubs ?? []).forEach((row: any) => {
      cloudEnabledMap[row.cloud_key] = Boolean(row.is_enabled)
    })
    cloudEnabledMap[cloudKey] = enabled

    const affectedModules = (modules ?? []) as ModuleDefinition[]
    const rows: Array<{ module_key: string; is_enabled: boolean; cloud_key?: string | null; app_key?: string | null }> = []
    const appKeysToEnable = new Set<string>()

    for (const moduleDef of affectedModules) {
      let shouldEnable = enabled
      if (!enabled) {
        shouldEnable = moduleDef.cloud_keys.some((key) => key !== cloudKey && cloudEnabledMap[key] === true)
      } else {
        moduleDef.app_keys.forEach((key) => appKeysToEnable.add(key))
      }
      rows.push({
        module_key: moduleDef.module_key,
        is_enabled: moduleDef.is_core ? true : shouldEnable,
        cloud_key: cloudKey,
        app_key: moduleDef.app_keys?.[0] ?? null,
      })
      await syncModulePermissions(moduleDef.module_key, moduleDef.is_core ? true : shouldEnable, user.org_id)
    }
    await upsertOrgModules(supabase, user.org_id, user.id, rows)

    if (enabled && appKeysToEnable.size) {
      const appPayload = Array.from(appKeysToEnable).map((appKey) => ({
        org_id: user.org_id,
        app_key: appKey,
        is_enabled: true,
        enabled_at: new Date().toISOString(),
      }))
      const { error: appError } = await supabase.from('org_app_subscriptions').upsert(appPayload, { onConflict: 'org_id,app_key' })
      if (appError) throw appError
    }

    revalidatePath('/system-setup/modules')
    revalidatePath('/system-setup/modules/clouds')
    revalidatePath('/system-setup/modules/apps')
    return ok({ cloudKey, enabled, activatedCount: affectedModules.length })
  } catch (error) {
    return fail(error)
  }
}

export async function toggleApp(appKey: string, enabled: boolean): Promise<ActionResult<{ appKey: string; enabled: boolean; affectedCount: number }>> {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const { data: modules, error: moduleError } = await supabase.from('module_definitions').select('*').contains('app_keys', [appKey])
    if (moduleError) throw moduleError

    const { error: appError } = await supabase.from('org_app_subscriptions').upsert(
      {
        org_id: user.org_id,
        app_key: appKey,
        is_enabled: enabled,
        enabled_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,app_key' }
    )
    if (appError) throw appError

    const rows = ((modules ?? []) as ModuleDefinition[]).map((moduleDef) => ({
      module_key: moduleDef.module_key,
      is_enabled: moduleDef.is_core ? true : enabled,
      cloud_key: moduleDef.cloud_keys?.[0] ?? null,
      app_key: appKey,
    }))
    await upsertOrgModules(supabase, user.org_id, user.id, rows)
    for (const moduleDef of (modules ?? []) as ModuleDefinition[]) {
      await syncModulePermissions(moduleDef.module_key, moduleDef.is_core ? true : enabled, user.org_id)
    }

    revalidatePath('/system-setup/modules')
    revalidatePath('/system-setup/modules/clouds')
    revalidatePath('/system-setup/modules/apps')
    return ok({ appKey, enabled, affectedCount: rows.length })
  } catch (error) {
    return fail(error)
  }
}

export async function saveModuleConfig(moduleKey: string, config: Record<string, any>): Promise<ActionResult<{ moduleKey: string }>> {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const { data: row, error: rowError } = await supabase
      .from('org_modules')
      .select('id')
      .eq('org_id', user.org_id)
      .eq('module_key', moduleKey)
      .maybeSingle()
    if (rowError) throw rowError
    if (!row) throw new Error('Module not initialized for this organisation.')
    const { error } = await supabase
      .from('org_modules')
      .update({ config, last_modified_at: new Date().toISOString(), last_modified_by: user.id })
      .eq('id', row.id)
    if (error) throw error
    revalidatePath('/system-setup/modules')
    return ok({ moduleKey })
  } catch (error) {
    return fail(error)
  }
}
