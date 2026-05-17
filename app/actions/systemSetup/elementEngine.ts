'use server'

import { createClient } from '@/lib/supabase.server'

type Result<T> = { data: T | null; error: string | null }

function ok<T>(data: T): Result<T> {
  return { data, error: null }
}

function fail<T = never>(error: unknown): Result<T> {
  return { data: null, error: error instanceof Error ? error.message : String(error || 'Element engine action failed.') }
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
  if (!roleNames.includes('superadmin') && !roleNames.includes('admin')) throw new Error('Only admins can manage Element Engine.')
  if (!user.org_id) throw new Error('Your user is not assigned to an organisation.')
  return { supabase, user }
}

export async function listElements() {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const { data, error } = await supabase
      .from('elements')
      .select('*')
      .eq('org_id', user.org_id)
      .order('is_core', { ascending: false })
      .order('label', { ascending: true })
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function getElementDetail(elementId: string) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const [
      { data: element, error: elementError },
      { data: dataPoints, error: pointsError },
      { data: dataBonds, error: bondsError },
      { data: dataRules, error: rulesError },
      { data: recordTypes, error: recordTypesError },
      { data: screenDesigns, error: layoutsError },
    ] = await Promise.all([
      supabase.from('elements').select('*').eq('org_id', user.org_id).eq('id', elementId).maybeSingle(),
      supabase.from('data_points').select('*').eq('org_id', user.org_id).eq('element_id', elementId).order('sort_order', { ascending: true }),
      supabase.from('data_bonds').select('*').eq('org_id', user.org_id).eq('source_element_id', elementId),
      supabase.from('data_rules').select('*').eq('org_id', user.org_id).eq('element_id', elementId),
      supabase.from('record_types').select('*').eq('org_id', user.org_id).eq('element_id', elementId).order('label', { ascending: true }),
      supabase.from('screen_designs').select('*').eq('org_id', user.org_id).eq('element_id', elementId).order('updated_at', { ascending: false }),
    ])
    if (elementError) throw elementError
    if (pointsError) throw pointsError
    if (bondsError) throw bondsError
    if (rulesError) throw rulesError
    if (recordTypesError) throw recordTypesError
    if (layoutsError) throw layoutsError
    if (!element) throw new Error('Element not found.')
    return ok({
      element,
      dataPoints: dataPoints ?? [],
      dataBonds: dataBonds ?? [],
      dataRules: dataRules ?? [],
      recordTypes: recordTypes ?? [],
      screenDesigns: screenDesigns ?? [],
    })
  } catch (error) {
    return fail(error)
  }
}

export async function upsertElement(input: {
  id?: string
  api_name: string
  label: string
  description?: string | null
  element_type: 'core' | 'adaptive'
  is_core: boolean
  storage_strategy: 'physical_table' | 'adaptive_json'
  physical_table_name?: string | null
  is_active: boolean
  metadata?: Record<string, any>
  business_unit_id?: string | null
}) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const payload = {
      org_id: user.org_id,
      business_unit_id: input.business_unit_id ?? user.business_unit_id ?? null,
      api_name: input.api_name.trim().toLowerCase(),
      label: input.label.trim(),
      description: input.description?.trim() || null,
      element_type: input.element_type,
      is_core: input.is_core,
      storage_strategy: input.storage_strategy,
      physical_table_name: input.physical_table_name?.trim() || null,
      is_active: input.is_active,
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }

    const query = input.id
      ? supabase.from('elements').update(payload).eq('id', input.id).eq('org_id', user.org_id)
      : supabase.from('elements').insert({ ...payload, created_by: user.id })

    const { data, error } = await query.select('*').single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function upsertDataPoint(input: {
  id?: string
  element_id: string
  api_name: string
  label: string
  description?: string | null
  data_point_type: 'core' | 'adaptive'
  field_type: string
  is_required: boolean
  is_unique: boolean
  is_readonly: boolean
  default_value?: any
  options?: any[]
  metadata?: Record<string, any>
  sort_order?: number
  is_active: boolean
  business_unit_id?: string | null
}) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const payload = {
      org_id: user.org_id,
      business_unit_id: input.business_unit_id ?? user.business_unit_id ?? null,
      element_id: input.element_id,
      api_name: input.api_name.trim().toLowerCase(),
      label: input.label.trim(),
      description: input.description?.trim() || null,
      data_point_type: input.data_point_type,
      field_type: input.field_type,
      is_required: input.is_required,
      is_unique: input.is_unique,
      is_readonly: input.is_readonly,
      default_value: input.default_value ?? null,
      options: input.options ?? [],
      metadata: input.metadata ?? {},
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }
    const query = input.id
      ? supabase.from('data_points').update(payload).eq('id', input.id).eq('org_id', user.org_id)
      : supabase.from('data_points').insert({ ...payload, created_by: user.id })
    const { data, error } = await query.select('*').single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteDataPoint(id: string) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const { error } = await supabase.from('data_points').delete().eq('id', id).eq('org_id', user.org_id)
    if (error) throw error
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function upsertDataBond(input: {
  id?: string
  source_element_id: string
  source_data_point_id?: string | null
  target_element_id: string
  bond_type: 'lookup' | 'required_lookup' | 'master_detail' | 'many_to_many'
  api_name: string
  label: string
  is_active: boolean
  metadata?: Record<string, any>
  business_unit_id?: string | null
}) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const payload = {
      org_id: user.org_id,
      business_unit_id: input.business_unit_id ?? user.business_unit_id ?? null,
      source_element_id: input.source_element_id,
      source_data_point_id: input.source_data_point_id ?? null,
      target_element_id: input.target_element_id,
      bond_type: input.bond_type,
      api_name: input.api_name.trim().toLowerCase(),
      label: input.label.trim(),
      is_active: input.is_active,
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }
    const query = input.id
      ? supabase.from('data_bonds').update(payload).eq('id', input.id).eq('org_id', user.org_id)
      : supabase.from('data_bonds').insert({ ...payload, created_by: user.id })
    const { data, error } = await query.select('*').single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteDataBond(id: string) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const { error } = await supabase.from('data_bonds').delete().eq('id', id).eq('org_id', user.org_id)
    if (error) throw error
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function upsertDataRule(input: {
  id?: string
  element_id: string
  api_name: string
  label: string
  description?: string | null
  expression: Record<string, any>
  error_message: string
  is_active: boolean
  business_unit_id?: string | null
}) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const payload = {
      org_id: user.org_id,
      business_unit_id: input.business_unit_id ?? user.business_unit_id ?? null,
      element_id: input.element_id,
      api_name: input.api_name.trim().toLowerCase(),
      label: input.label.trim(),
      description: input.description?.trim() || null,
      expression: input.expression,
      error_message: input.error_message.trim(),
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }
    const query = input.id
      ? supabase.from('data_rules').update(payload).eq('id', input.id).eq('org_id', user.org_id)
      : supabase.from('data_rules').insert({ ...payload, created_by: user.id })
    const { data, error } = await query.select('*').single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteDataRule(id: string) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const { error } = await supabase.from('data_rules').delete().eq('id', id).eq('org_id', user.org_id)
    if (error) throw error
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function upsertScreenDesign(input: {
  id?: string
  element_id: string
  record_type_id?: string | null
  actor_role_id?: string | null
  business_unit_id?: string | null
  layout_name: string
  is_default: boolean
  sections: any[]
  is_active: boolean
}) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const payload = {
      org_id: user.org_id,
      business_unit_id: input.business_unit_id ?? user.business_unit_id ?? null,
      element_id: input.element_id,
      record_type_id: input.record_type_id ?? null,
      actor_role_id: input.actor_role_id ?? null,
      layout_name: input.layout_name.trim() || 'Default Screen',
      is_default: input.is_default,
      sections: input.sections ?? [],
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }

    if (input.is_default) {
      await supabase
        .from('screen_designs')
        .update({ is_default: false })
        .eq('org_id', user.org_id)
        .eq('element_id', input.element_id)
        .eq('business_unit_id', payload.business_unit_id)
    }

    const query = input.id
      ? supabase.from('screen_designs').update(payload).eq('id', input.id).eq('org_id', user.org_id)
      : supabase.from('screen_designs').insert({ ...payload, created_by: user.id })
    const { data, error } = await query.select('*').single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function compileElementMetadata(input: {
  elementApiName: string
  businessUnitId?: string | null
  actorRoleId?: string | null
  recordTypeId?: string | null
}) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const businessUnitId = input.businessUnitId ?? user.business_unit_id ?? null
    const elementQuery = supabase
      .from('elements')
      .select('*')
      .eq('org_id', user.org_id)
      .eq('api_name', input.elementApiName.trim().toLowerCase())
      .eq('is_active', true)
      .order('is_core', { ascending: false })
      .limit(1)
    if (businessUnitId) {
      elementQuery.or(`business_unit_id.eq.${businessUnitId},business_unit_id.is.null`)
    }
    const { data: elementRows, error: elementError } = await elementQuery
    if (elementError) throw elementError
    const element = elementRows?.[0]
    if (!element) throw new Error('Element not found.')

    const [
      { data: points, error: pointsError },
      { data: bonds, error: bondsError },
      { data: rules, error: rulesError },
      { data: designs, error: designsError },
      { data: profilePermissions, error: profilePermError },
      { data: setPermissions, error: setPermError },
    ] = await Promise.all([
      supabase.from('data_points').select('*').eq('org_id', user.org_id).eq('element_id', element.id).eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('data_bonds').select('*').eq('org_id', user.org_id).eq('source_element_id', element.id).eq('is_active', true),
      supabase.from('data_rules').select('*').eq('org_id', user.org_id).eq('element_id', element.id).eq('is_active', true),
      supabase
        .from('screen_designs')
        .select('*')
        .eq('org_id', user.org_id)
        .eq('element_id', element.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false }),
      supabase.from('role_permissions').select('*').eq('role_id', input.actorRoleId ?? '').eq('module_key', element.api_name).limit(1),
      supabase
        .from('permission_set_permissions')
        .select('permission_sets_id, module_key, can_create, can_read, can_update, can_delete')
        .eq('module_key', element.api_name),
    ])
    if (pointsError) throw pointsError
    if (bondsError) throw bondsError
    if (rulesError) throw rulesError
    if (designsError) throw designsError
    if (profilePermError) throw profilePermError
    if (setPermError) throw setPermError

    const screenDesign =
      (designs ?? []).find((row: any) => input.recordTypeId && row.record_type_id === input.recordTypeId && row.actor_role_id === (input.actorRoleId ?? null)) ??
      (designs ?? []).find((row: any) => row.record_type_id === null && row.actor_role_id === (input.actorRoleId ?? null) && row.is_default) ??
      (designs ?? []).find((row: any) => row.is_default) ??
      (designs ?? [])[0] ??
      null

    return ok({
      element,
      data_points: points ?? [],
      data_bonds: bonds ?? [],
      data_rules: rules ?? [],
      screen_design: screenDesign,
      permissions: {
        actor_role: profilePermissions?.[0] ?? null,
        add_on_permissions: setPermissions ?? [],
      },
      storage_target: {
        strategy: element.storage_strategy,
        table: element.physical_table_name,
      },
    })
  } catch (error) {
    return fail(error)
  }
}
