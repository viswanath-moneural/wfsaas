import { createClient } from '@/lib/supabase.server'
import type { DataRuleDefinition } from '@/types/metadata'
import { runRules, type ValidationResult } from './data-rules-core'

export type { ValidationResult } from './data-rules-core'

export async function validateRecord(
  elementKey: string,
  recordData: Record<string, any>,
  orgId: string,
  operation: 'insert' | 'update'
): Promise<ValidationResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('data_rule_definitions')
    .select('rule_key, rule_name, condition_formula, error_message, error_field_key, trigger_on, is_active')
    .eq('org_id', orgId)
    .eq('element_key', elementKey)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return {
      valid: false,
      errors: [{ field_key: null, message: error.message, rule_key: 'rules_fetch_failed' }],
    }
  }

  return runRules((data ?? []) as DataRuleDefinition[], recordData, operation)
}
