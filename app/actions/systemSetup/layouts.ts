'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase.server'
import { LAYOUT_MODULES, MODULE_FIELDS } from '@/lib/layoutBuilder'

export type LayoutField = {
  id: string
  label: string
  required: boolean
  visible: boolean
  readOnly?: boolean
  helpText?: string
  column: number
  row: number
  visibility?: { field: string; value: string } | null
}

export type LayoutSection = {
  id: string
  title: string
  columns: 1 | 2
  fields: LayoutField[]
}

export type PageLayout = {
  id: string
  org_id: string
  business_unit_id: string
  module_key: string
  layout_name: string
  is_default: boolean
  sections: LayoutSection[]
  last_modified_at: string | null
}

type Result<T> = { data: T | null; error: string | null }

function ok<T>(data: T): Result<T> {
  return { data, error: null }
}

function fail<T = never>(error: unknown): Result<T> {
  return { data: null, error: error instanceof Error ? error.message : String(error || 'Layout action failed.') }
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
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
  if (!roleNames.includes('superadmin') && !roleNames.includes('admin')) throw new Error('Only admins can manage System Setup.')
  if (!user.org_id) throw new Error('Your user is not assigned to an organisation.')
  return { supabase, user }
}

async function getBusinessUnitScope(supabase: any, user: any, businessUnitId?: string | null) {
  const targetId = businessUnitId || user.business_unit_id
  if (!targetId) throw new Error('Select a Business Unit before managing layouts.')

  const { data, error } = await supabase
    .from('business_units')
    .select('id, name, org_id')
    .eq('id', targetId)
    .eq('org_id', user.org_id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Business Unit not found for your organisation.')
  return data
}

async function getBusinessUnitsForUser(supabase: any, user: any) {
  const { data, error } = await supabase
    .from('business_units')
    .select('id, name, org_id, is_active')
    .eq('org_id', user.org_id)
    .order('name')
  if (error) throw error
  return data ?? []
}

function defaultSections(moduleKey: string): LayoutSection[] {
  const fields = (MODULE_FIELDS[moduleKey] ?? []).slice(0, 6).map((field, index) => ({
    id: field,
    label: humanize(field),
    required: index < 2,
    visible: true,
    readOnly: false,
    helpText: '',
    column: (index % 2) + 1,
    row: Math.floor(index / 2) + 1,
    visibility: null,
  }))
  return [{ id: 'section_1', title: 'Basic Information', columns: 2, fields }]
}

export async function getLayoutModules(businessUnitId?: string | null): Promise<Result<any>> {
  try {
    const { supabase, user } = await requireSetupAdmin()
    const [businessUnits, selectedBusinessUnit] = await Promise.all([
      getBusinessUnitsForUser(supabase, user),
      getBusinessUnitScope(supabase, user, businessUnitId),
    ])
    const { data: layouts, error } = await supabase
      .from('page_layouts')
      .select('id, module_key, is_default, last_modified_at')
      .eq('org_id', user.org_id)
      .eq('business_unit_id', selectedBusinessUnit.id)
    if (error) throw error
    const modules = LAYOUT_MODULES.map((module) => {
      const moduleLayouts = (layouts ?? []).filter((layout: any) => layout.module_key === module.key)
      const lastModified = moduleLayouts.map((layout: any) => layout.last_modified_at).filter(Boolean).sort().at(-1) ?? null
      return { ...module, layoutCount: moduleLayouts.length, lastModified }
    })
    return ok({ modules, businessUnits, selectedBusinessUnitId: selectedBusinessUnit.id })
  } catch (error) {
    return fail(error)
  }
}

export async function getLayoutEditorData(moduleKey: string, businessUnitId?: string | null): Promise<Result<any>> {
  try {
    const { supabase, user } = await requireSetupAdmin()
    if (!MODULE_FIELDS[moduleKey]) throw new Error('Unknown module.')
    const [businessUnits, selectedBusinessUnit] = await Promise.all([
      getBusinessUnitsForUser(supabase, user),
      getBusinessUnitScope(supabase, user, businessUnitId),
    ])
    const { data: layoutRows, error } = await supabase
      .from('page_layouts')
      .select('*')
      .eq('org_id', user.org_id)
      .eq('business_unit_id', selectedBusinessUnit.id)
      .eq('module_key', moduleKey)
      .order('is_default', { ascending: false })
      .order('last_modified_at', { ascending: false })
    if (error) throw error

    const layout = layoutRows?.[0] ?? {
      id: null,
      org_id: user.org_id,
      business_unit_id: selectedBusinessUnit.id,
      module_key: moduleKey,
      layout_name: 'Default Layout',
      is_default: true,
      sections: defaultSections(moduleKey),
      last_modified_at: null,
    }

    return ok({
      module: LAYOUT_MODULES.find((item) => item.key === moduleKey),
      businessUnits,
      selectedBusinessUnitId: selectedBusinessUnit.id,
      fields: MODULE_FIELDS[moduleKey].map((field) => ({ id: field, label: humanize(field) })),
      layout,
    })
  } catch (error) {
    return fail(error)
  }
}

export async function savePageLayout(input: {
  id?: string | null
  business_unit_id: string
  module_key: string
  layout_name: string
  is_default: boolean
  sections: LayoutSection[]
}): Promise<Result<PageLayout>> {
  try {
    const { supabase, user } = await requireSetupAdmin()
    if (!MODULE_FIELDS[input.module_key]) throw new Error('Unknown module.')
    const businessUnit = await getBusinessUnitScope(supabase, user, input.business_unit_id)
    if (input.is_default) {
      await supabase
        .from('page_layouts')
        .update({ is_default: false })
        .eq('org_id', user.org_id)
        .eq('business_unit_id', businessUnit.id)
        .eq('module_key', input.module_key)
    }

    const payload = {
      org_id: user.org_id,
      business_unit_id: businessUnit.id,
      module_key: input.module_key,
      layout_name: input.layout_name.trim() || 'Default Layout',
      is_default: input.is_default,
      sections: input.sections,
      last_modified_at: new Date().toISOString(),
      last_modified_by: user.id,
    }

    const query = input.id
      ? supabase.from('page_layouts').update(payload).eq('id', input.id).eq('org_id', user.org_id).eq('business_unit_id', businessUnit.id)
      : supabase.from('page_layouts').insert({ ...payload, created_by: user.id })

    const { data, error } = await query.select('*').single()
    if (error) throw error
    revalidatePath('/system-setup/layouts')
    revalidatePath(`/system-setup/layouts/${input.module_key}`)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

export async function getDefaultLayout(moduleKey: string, businessUnitId?: string | null): Promise<Result<PageLayout | null>> {
  try {
    const supabase = await createClient()
    let targetBusinessUnitId = businessUnitId ?? null
    if (!targetBusinessUnitId) {
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('business_unit_id')
          .eq('id', auth.user.id)
          .maybeSingle()
        if (userError) throw userError
        targetBusinessUnitId = user?.business_unit_id ?? null
      }
    }
    if (!targetBusinessUnitId) return ok(null)
    const { data, error } = await supabase
      .from('page_layouts')
      .select('*')
      .eq('module_key', moduleKey)
      .eq('business_unit_id', targetBusinessUnitId)
      .eq('is_default', true)
      .maybeSingle()
    if (error) throw error
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}
