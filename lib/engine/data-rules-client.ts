'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DataRuleDefinition } from '@/types/metadata'
import { runRules, type ValidationResult, parseDataRuleViolationError } from './data-rules-core'

const RULES_CACHE = new Map<string, { expiresAt: number; rules: DataRuleDefinition[] }>()
const TTL_MS = 5 * 60 * 1000

async function fetchRules(elementKey: string): Promise<DataRuleDefinition[]> {
  const cached = RULES_CACHE.get(elementKey)
  if (cached && cached.expiresAt > Date.now()) return cached.rules
  const res = await fetch(`/api/metadata/elements/${elementKey}/rules`, { method: 'GET', credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to load rules (${res.status})`)
  const json = await res.json()
  const rules = (json.rules ?? []) as DataRuleDefinition[]
  RULES_CACHE.set(elementKey, { rules, expiresAt: Date.now() + TTL_MS })
  return rules
}

export function useDataRules(elementKey: string) {
  const [rules, setRules] = useState<DataRuleDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchRules(elementKey)
      .then((rows) => {
        if (!mounted) return
        setRules(rows)
        setError(null)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Rules load failed')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [elementKey])

  const validate = useMemo(() => {
    return (data: Record<string, any>, operation: 'insert' | 'update' = 'insert'): ValidationResult => runRules(rules, data, operation)
  }, [rules])

  return { validate, rules, loading, error }
}

export { parseDataRuleViolationError }
