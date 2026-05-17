'use server'

import { createClient } from '@/lib/supabase.server'

type Result<T> = { data: T | null; error: string | null }
const ok = <T,>(data: T): Result<T> => ({ data, error: null })
const fail = <T = never,>(error: unknown): Result<T> => ({ data: null, error: error instanceof Error ? error.message : String(error || 'Element engine action failed.') })

async function requireSetupAdmin() {
  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('You must be signed in.')
  const { data: user, error: userError } = await supabase.from('users').select('*, roles(role_name, name, label)').eq('id', auth.user.id).maybeSingle()
  if (userError) throw userError
  if (!user || user.is_active === false || !user.org_id) throw new Error('Your user profile is not active or not linked to an organisation.')
  const { data: roleRows, error: roleError } = await supabase.from('user_roles').select('roles(role_name, name, label)').eq('user_id', auth.user.id).eq('is_active', true)
  if (roleError) throw roleError
  const roleNames = [
    String(user.role ?? '').toLowerCase(),
    String(user.roles?.role_name ?? user.roles?.name ?? user.roles?.label ?? '').toLowerCase(),
    ...((roleRows ?? []).map((row: any) => String(row.roles?.role_name ?? row.roles?.name ?? row.roles?.label ?? '').toLowerCase())),
  ]
  if (!roleNames.includes('superadmin') && !roleNames.includes('admin')) throw new Error('Only admins can manage Element Engine.')
  return { supabase, user }
}

async function resolveBusinessUnitId(supabase: any, orgId: string, userBusinessUnitId: string | null | undefined, requestedBusinessUnitId?: string | null) {
  const wanted = requestedBusinessUnitId ?? userBusinessUnitId ?? null
  if (!wanted) throw new Error('No active Business Unit selected.')
  const { data, error } = await supabase.from('business_units').select('id').eq('org_id', orgId).eq('id', wanted).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Selected Business Unit is not in your organisation.')
  return wanted
}

function toElementRow(row: any) {
  return {
    id: row.id,
    api_name: row.element_key,
    label: row.element_name,
    description: row.description ?? null,
    element_type: row.is_core ? 'core' : 'adaptive',
    is_core: !!row.is_core,
    storage_strategy: row.config?.storage_strategy ?? 'physical_table',
    physical_table_name: row.table_name ?? null,
    is_active: !!row.is_active,
  }
}

export async function listBusinessUnitsForSetup() {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const { data, error } = await supabase.from('business_units').select('id, business_unit_name, is_active').eq('org_id', user.org_id).order('business_unit_name', { ascending: true })
    if (error) throw error
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function listElements(businessUnitId?: string | null) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, businessUnitId)
    const { data, error } = await supabase.from('element_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).order('is_core', { ascending: false }).order('sort_order', { ascending: true }).order('element_name', { ascending: true })
    if (error) throw error
    return ok((data ?? []).map(toElementRow))
  } catch (error) {
    return fail(error)
  }
}

export async function getElementDetail(elementId: string, businessUnitId?: string | null) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, businessUnitId)
    const { data: elementRaw, error: elementError } = await supabase.from('element_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('id', elementId).maybeSingle()
    if (elementError) throw elementError
    if (!elementRaw) throw new Error('Element not found.')
    const element = toElementRow(elementRaw)
    const k = element.api_name
    const [{ data: pts }, { data: bonds }, { data: rules }, { data: recordTypes }, { data: layouts }] = await Promise.all([
      supabase.from('data_point_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('element_key', k).order('sort_order', { ascending: true }),
      supabase.from('data_bond_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('from_element_key', k).order('bond_name', { ascending: true }),
      supabase.from('data_rule_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('element_key', k).order('sort_order', { ascending: true }),
      supabase.from('record_types').select('*').eq('org_id', user.org_id).eq('element_id', elementId).order('label', { ascending: true }),
      supabase.from('screen_design_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('element_key', k).order('last_modified_at', { ascending: false }),
    ])
    return ok({
      element,
      dataPoints: (pts ?? []).map((r: any) => ({ id: r.id, api_name: r.field_key, label: r.field_label, field_type: r.field_type })),
      dataBonds: (bonds ?? []).map((r: any) => ({ id: r.id, api_name: r.bond_key, label: r.bond_name, bond_type: r.bond_type })),
      dataRules: (rules ?? []).map((r: any) => ({ id: r.id, api_name: r.rule_key, label: r.rule_name, error_message: r.error_message })),
      recordTypes: recordTypes ?? [],
      screenDesigns: (layouts ?? []).map((r: any) => ({ id: r.id, layout_name: r.design_name, sections: r.sections ?? [], is_default: r.is_default, updated_at: r.last_modified_at ?? r.created_at })),
    })
  } catch (error) {
    return fail(error)
  }
}

export async function upsertElement(input: any) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, input.business_unit_id)
    const k = String(input.api_name).trim().toLowerCase()
    const payload = {
      org_id: user.org_id,
      business_unit_id: buId,
      element_key: k,
      element_name: String(input.label).trim(),
      element_name_plural: String(input.label).trim().endsWith('s') ? String(input.label).trim() : `${String(input.label).trim()}s`,
      description: input.description?.trim() || null,
      table_name: input.physical_table_name?.trim() || k,
      is_core: input.element_type === 'core',
      is_active: !!input.is_active,
      config: { ...(input.metadata ?? {}), storage_strategy: input.storage_strategy ?? 'physical_table' },
      last_modified_at: new Date().toISOString(),
      last_modified_by: user.id,
    }
    const q = input.id ? supabase.from('element_definitions').update(payload).eq('id', input.id).eq('org_id', user.org_id).eq('business_unit_id', buId) : supabase.from('element_definitions').insert({ ...payload, created_by: user.id })
    const { data, error } = await q.select('*').single()
    if (error) throw error
    return ok(toElementRow(data))
  } catch (error) {
    return fail(error)
  }
}

export async function upsertDataPoint(input: any) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, input.business_unit_id)
    const { data: e, error: eErr } = await supabase.from('element_definitions').select('element_key').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('id', input.element_id).single()
    if (eErr) throw eErr
    const payload = { org_id: user.org_id, business_unit_id: buId, element_key: e.element_key, field_key: String(input.api_name).trim().toLowerCase(), field_label: String(input.label).trim(), field_type: input.field_type, is_core: input.data_point_type === 'core', is_required: !!input.is_required, is_unique: !!input.is_unique, is_read_only: !!input.is_readonly, is_active: !!input.is_active, last_modified_at: new Date().toISOString(), last_modified_by: user.id }
    const q = input.id ? supabase.from('data_point_definitions').update(payload).eq('id', input.id).eq('org_id', user.org_id).eq('business_unit_id', buId) : supabase.from('data_point_definitions').insert({ ...payload, created_by: user.id })
    const { data, error } = await q.select('*').single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteDataPoint(id: string, businessUnitId?: string | null) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, businessUnitId)
    const { error } = await supabase.from('data_point_definitions').delete().eq('id', id).eq('org_id', user.org_id).eq('business_unit_id', buId)
    if (error) throw error
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function upsertDataBond(input: any) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, input.business_unit_id)
    const { data: s, error: sErr } = await supabase.from('element_definitions').select('element_key').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('id', input.source_element_id).single()
    if (sErr) throw sErr
    const { data: t, error: tErr } = await supabase.from('element_definitions').select('element_key').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('id', input.target_element_id).single()
    if (tErr) throw tErr
    const payload = { org_id: user.org_id, business_unit_id: buId, bond_key: String(input.api_name).trim().toLowerCase(), bond_name: String(input.label).trim(), bond_type: input.bond_type, from_element_key: s.element_key, from_field_key: `${t.element_key}_id`, to_element_key: t.element_key, to_field_key: 'id', is_required: input.bond_type === 'required_lookup' || input.bond_type === 'master_detail', last_modified_at: new Date().toISOString(), last_modified_by: user.id }
    const q = input.id ? supabase.from('data_bond_definitions').update(payload).eq('id', input.id).eq('org_id', user.org_id).eq('business_unit_id', buId) : supabase.from('data_bond_definitions').insert({ ...payload, created_by: user.id })
    const { data, error } = await q.select('*').single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteDataBond(id: string, businessUnitId?: string | null) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, businessUnitId)
    const { error } = await supabase.from('data_bond_definitions').delete().eq('id', id).eq('org_id', user.org_id).eq('business_unit_id', buId)
    if (error) throw error
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function upsertDataRule(input: any) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, input.business_unit_id)
    const { data: e, error: eErr } = await supabase.from('element_definitions').select('element_key').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('id', input.element_id).single()
    if (eErr) throw eErr
    const payload = { org_id: user.org_id, business_unit_id: buId, element_key: e.element_key, rule_key: String(input.api_name).trim().toLowerCase(), rule_name: String(input.label).trim(), description: input.description?.trim() || null, condition_formula: JSON.stringify(input.expression ?? {}), error_message: String(input.error_message).trim(), is_active: !!input.is_active, last_modified_at: new Date().toISOString(), last_modified_by: user.id }
    const q = input.id ? supabase.from('data_rule_definitions').update(payload).eq('id', input.id).eq('org_id', user.org_id).eq('business_unit_id', buId) : supabase.from('data_rule_definitions').insert({ ...payload, created_by: user.id })
    const { data, error } = await q.select('*').single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteDataRule(id: string, businessUnitId?: string | null) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, businessUnitId)
    const { error } = await supabase.from('data_rule_definitions').delete().eq('id', id).eq('org_id', user.org_id).eq('business_unit_id', buId)
    if (error) throw error
    return ok({ id })
  } catch (error) {
    return fail(error)
  }
}

export async function upsertScreenDesign(input: any) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, input.business_unit_id)
    const { data: e, error: eErr } = await supabase.from('element_definitions').select('element_key').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('id', input.element_id).single()
    if (eErr) throw eErr
    if (input.is_default) await supabase.from('screen_design_definitions').update({ is_default: false }).eq('org_id', user.org_id).eq('business_unit_id', buId).eq('element_key', e.element_key)
    const payload = { org_id: user.org_id, business_unit_id: buId, element_key: e.element_key, design_name: String(input.layout_name || 'Default Layout').trim(), is_default: !!input.is_default, sections: input.sections ?? [], last_modified_at: new Date().toISOString(), last_modified_by: user.id }
    const q = input.id ? supabase.from('screen_design_definitions').update(payload).eq('id', input.id).eq('org_id', user.org_id).eq('business_unit_id', buId) : supabase.from('screen_design_definitions').insert({ ...payload, created_by: user.id })
    const { data, error } = await q.select('*').single()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function compileElementMetadata(input: { elementApiName: string; actorRoleId?: string | null; business_unit_id?: string | null }) {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const buId = await resolveBusinessUnitId(supabase, user.org_id, user.business_unit_id, input.business_unit_id)
    const k = input.elementApiName.trim().toLowerCase()
    const { data: elementRaw, error: elementError } = await supabase.from('element_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('element_key', k).eq('is_active', true).maybeSingle()
    if (elementError) throw elementError
    if (!elementRaw) throw new Error('Element not found.')
    const [{ data: points }, { data: bonds }, { data: rules }, { data: layouts }, { data: rolePerm }, { data: setPerms }] = await Promise.all([
      supabase.from('data_point_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('element_key', k).eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('data_bond_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('from_element_key', k),
      supabase.from('data_rule_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('element_key', k).eq('is_active', true),
      supabase.from('screen_design_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', buId).eq('element_key', k).order('is_default', { ascending: false }).order('last_modified_at', { ascending: false }),
      supabase.from('role_permissions').select('*').eq('role_id', input.actorRoleId ?? '').eq('module_key', k).limit(1),
      supabase.from('permission_set_permissions').select('permission_sets_id, module_key, can_create, can_read, can_update, can_delete').eq('module_key', k),
    ])
    return ok({
      element: toElementRow(elementRaw),
      data_points: (points ?? []).map((r: any) => ({ id: r.id, api_name: r.field_key, label: r.field_label, field_type: r.field_type, is_required: r.is_required, is_readonly: r.is_read_only })),
      data_bonds: (bonds ?? []).map((r: any) => ({ id: r.id, api_name: r.bond_key, label: r.bond_name, bond_type: r.bond_type })),
      data_rules: (rules ?? []).map((r: any) => ({ id: r.id, api_name: r.rule_key, label: r.rule_name, expression: r.condition_formula, error_message: r.error_message })),
      screen_design: (layouts ?? []).find((r: any) => r.is_default) ?? (layouts ?? [])[0] ?? null,
      permissions: { actor_role: rolePerm?.[0] ?? null, add_on_permissions: setPerms ?? [] },
      storage_target: { strategy: elementRaw.config?.storage_strategy ?? 'physical_table', table: elementRaw.table_name },
    })
  } catch (error) {
    return fail(error)
  }
}
