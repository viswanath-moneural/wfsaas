import { createClient } from '@/lib/supabase.server'
import type { DataPointDefinition, ScreenField, ScreenSection } from '@/types/metadata'

async function resolveBusinessUnitId(supabase: any, orgId: string) {
  const { data, error } = await supabase
    .from('business_units')
    .select('id')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error('No active business unit found for organisation.')
  return data.id as string
}

function isSystemField(fieldKey: string) {
  return ['created_at', 'created_by', 'last_modified_at', 'last_modified_by'].includes(fieldKey)
}

function bySortOrder(a: DataPointDefinition, b: DataPointDefinition) {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0)
}

export function assignFieldsToGrid(fields: DataPointDefinition[], columns: 1 | 2): ScreenField[] {
  let leftRow = 1
  let rightRow = 1
  let turn: 1 | 2 = 1
  return fields.map((field) => {
    const forcedCol = field.is_required ? 1 : turn
    const row = forcedCol === 1 ? leftRow++ : rightRow++
    if (!field.is_required && columns === 2) turn = turn === 1 ? 2 : 1
    return {
      field_key: field.field_key,
      column: columns === 1 ? 1 : forcedCol,
      row,
    }
  })
}

export async function generateDefaultLayout(elementKey: string, orgId: string): Promise<ScreenSection[]> {
  const supabase = await createClient()
  const businessUnitId = await resolveBusinessUnitId(supabase, orgId)
  const { data, error } = await supabase
    .from('data_point_definitions')
    .select('*')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .eq('is_active', true)
    .eq('is_system', false)
    .order('sort_order', { ascending: true })
  if (error) throw error

  const fields = (data ?? []) as DataPointDefinition[]
  const required = fields.filter((f) => f.is_required).sort(bySortOrder)
  const basic = fields.filter((f) => ['text', 'phone', 'email', 'picklist', 'multi_picklist'].includes(f.field_type) && !f.is_required).sort(bySortOrder)
  const additional = fields.filter((f) => ['number', 'currency', 'percentage', 'date', 'datetime', 'boolean'].includes(f.field_type)).sort(bySortOrder)
  const relationships = fields.filter((f) => f.field_type === 'lookup').sort(bySortOrder)
  const notes = fields.filter((f) => ['long_text', 'rich_text'].includes(f.field_type)).sort(bySortOrder)

  const section1Fields = [...required, ...basic].slice(0, 8)
  const section2Fields = additional.filter((f) => !section1Fields.some((x) => x.field_key === f.field_key)).slice(0, 6)
  const section3Fields = relationships.filter((f) => !section1Fields.some((x) => x.field_key === f.field_key))

  const sections: ScreenSection[] = []
  if (section1Fields.length) {
    sections.push({
      id: 'sec_basic',
      title: 'Basic Information',
      columns: 2,
      collapsible: false,
      fields: assignFieldsToGrid(section1Fields, 2),
    })
  }
  if (section2Fields.length) {
    sections.push({
      id: 'sec_additional',
      title: 'Additional Details',
      columns: 2,
      collapsible: false,
      fields: assignFieldsToGrid(section2Fields, 2),
    })
  }
  if (section3Fields.length) {
    sections.push({
      id: 'sec_relationships',
      title: 'Relationships',
      columns: 2,
      collapsible: false,
      fields: assignFieldsToGrid(section3Fields, 2),
    })
  }
  if (notes.length) {
    sections.push({
      id: 'sec_notes',
      title: 'Notes & Other',
      columns: 1,
      collapsible: false,
      fields: notes.map((field, index) => ({ field_key: field.field_key, column: 1, row: index + 1 })),
    })
  }

  const { data: systemRows } = await supabase
    .from('data_point_definitions')
    .select('*')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const systemFields = ((systemRows ?? []) as DataPointDefinition[]).filter((f) => isSystemField(f.field_key))
  if (systemFields.length) {
    sections.push({
      id: 'sec_system',
      title: 'System Information',
      columns: 2,
      collapsible: true,
      fields: assignFieldsToGrid(systemFields, 2),
    })
  }

  return sections
}

export async function saveDefaultLayout(elementKey: string, orgId: string, sections: ScreenSection[]): Promise<void> {
  const supabase = await createClient()
  const businessUnitId = await resolveBusinessUnitId(supabase, orgId)
  await supabase
    .from('screen_design_definitions')
    .update({ is_default: false })
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)

  const { error } = await supabase
    .from('screen_design_definitions')
    .upsert(
      {
        org_id: orgId,
        business_unit_id: businessUnitId,
        element_key: elementKey,
        design_name: 'Default Layout',
        is_default: true,
        sections,
      },
      { onConflict: 'org_id,business_unit_id,element_key,design_name' }
    )
  if (error) throw error
}

export async function getLayoutForElement(
  elementKey: string,
  orgId: string,
  roleId?: string
): Promise<{ sections: ScreenSection[]; available_fields: DataPointDefinition[] }> {
  const supabase = await createClient()
  const businessUnitId = await resolveBusinessUnitId(supabase, orgId)

  let sections: ScreenSection[] | null = null
  if (roleId) {
    const { data: assigned } = await supabase
      .from('screen_design_assignments')
      .select('screen_design_id, screen_design_definitions(sections)')
      .eq('org_id', orgId)
      .eq('business_unit_id', businessUnitId)
      .eq('element_key', elementKey)
      .eq('role_id', roleId)
      .maybeSingle()
    sections = (assigned as any)?.screen_design_definitions?.sections ?? null
  }

  if (!sections) {
    const { data: design } = await supabase
      .from('screen_design_definitions')
      .select('sections')
      .eq('org_id', orgId)
      .eq('business_unit_id', businessUnitId)
      .eq('element_key', elementKey)
      .eq('is_default', true)
      .maybeSingle()
    sections = (design?.sections as ScreenSection[] | null) ?? null
  }

  if (!sections) {
    sections = await generateDefaultLayout(elementKey, orgId)
    await saveDefaultLayout(elementKey, orgId, sections)
  }

  const { data: allFieldsRaw, error: fieldsError } = await supabase
    .from('data_point_definitions')
    .select('*')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', elementKey)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (fieldsError) throw fieldsError
  const allFields = (allFieldsRaw ?? []) as DataPointDefinition[]
  const used = new Set(sections.flatMap((s) => s.fields.map((f) => f.field_key)))
  const available_fields = allFields.filter((f) => !used.has(f.field_key))
  return { sections, available_fields }
}

export async function updateLayout(
  screenDesignId: string,
  sections: ScreenSection[],
  orgId: string
): Promise<void> {
  const supabase = await createClient()
  const businessUnitId = await resolveBusinessUnitId(supabase, orgId)
  const { data: design, error: designErr } = await supabase
    .from('screen_design_definitions')
    .select('id, element_key')
    .eq('id', screenDesignId)
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .maybeSingle()
  if (designErr) throw designErr
  if (!design) throw new Error('Screen design not found.')

  const { data: fields } = await supabase
    .from('data_point_definitions')
    .select('field_key')
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .eq('element_key', design.element_key)
    .eq('is_active', true)
  const valid = new Set((fields ?? []).map((f: any) => f.field_key))
  const unknown = sections.flatMap((s) => s.fields).find((f) => !valid.has(f.field_key))
  if (unknown) throw new Error(`Unknown field_key in layout: ${unknown.field_key}`)

  const { error } = await supabase
    .from('screen_design_definitions')
    .update({ sections, last_modified_at: new Date().toISOString() })
    .eq('id', screenDesignId)
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
  if (error) throw error

  await supabase
    .from('metadata_cache')
    .delete()
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .ilike('cache_key', `element:${design.element_key}:%`)
}

export async function cloneLayout(
  screenDesignId: string,
  newDesignName: string,
  orgId: string
): Promise<string> {
  const supabase = await createClient()
  const businessUnitId = await resolveBusinessUnitId(supabase, orgId)
  const { data: source, error: sourceErr } = await supabase
    .from('screen_design_definitions')
    .select('element_key, sections')
    .eq('id', screenDesignId)
    .eq('org_id', orgId)
    .eq('business_unit_id', businessUnitId)
    .single()
  if (sourceErr) throw sourceErr

  const { data: inserted, error } = await supabase
    .from('screen_design_definitions')
    .insert({
      org_id: orgId,
      business_unit_id: businessUnitId,
      element_key: source.element_key,
      design_name: newDesignName,
      is_default: false,
      sections: source.sections,
    })
    .select('id')
    .single()
  if (error) throw error
  return inserted.id as string
}

export async function assignLayoutToRole(
  screenDesignId: string,
  roleId: string,
  elementKey: string,
  orgId: string
): Promise<void> {
  const supabase = await createClient()
  const businessUnitId = await resolveBusinessUnitId(supabase, orgId)
  const { error } = await supabase
    .from('screen_design_assignments')
    .upsert(
      {
        org_id: orgId,
        business_unit_id: businessUnitId,
        screen_design_id: screenDesignId,
        role_id: roleId,
        element_key: elementKey,
      },
      { onConflict: 'org_id,business_unit_id,role_id,element_key' }
    )
  if (error) throw error
}

export async function ensureDefaultScreenDesign(input: {
  orgId: string
  businessUnitId: string
  elementKey: string
  userId: string
}) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('screen_design_definitions')
    .select('id, design_name, sections, is_default')
    .eq('org_id', input.orgId)
    .eq('business_unit_id', input.businessUnitId)
    .eq('element_key', input.elementKey)
    .eq('is_default', true)
    .maybeSingle()
  if (existing) return existing

  const sections = await generateDefaultLayout(input.elementKey, input.orgId)
  const { data, error } = await supabase
    .from('screen_design_definitions')
    .insert({
      org_id: input.orgId,
      business_unit_id: input.businessUnitId,
      element_key: input.elementKey,
      design_name: 'Default Layout',
      is_default: true,
      sections,
      created_by: input.userId,
      last_modified_by: input.userId,
    })
    .select('id, design_name, sections, is_default')
    .single()
  if (error) throw error
  return data
}

export const ScreenDesignEngine = {
  assignFieldsToGrid,
  generateDefaultLayout,
  saveDefaultLayout,
  getLayoutForElement,
  updateLayout,
  cloneLayout,
  assignLayoutToRole,
  ensureDefaultScreenDesign,
}
