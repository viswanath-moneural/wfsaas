'use client'

import { useEffect, useMemo, useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { MODULE_LIST } from '@/lib/modules'
import { useAuth } from '@/lib/AuthContext'
import { usePermissions } from '@/lib/permissions/usePermissions'
import { getSupabaseClient } from '@/lib/supabase'
import { toggleModule } from '@/app/actions/platform'

export default function ConfigurationModulesPage() {
  const { org } = useAuth()
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const { canEdit } = usePermissions('configuration')

  useEffect(() => {
    if (!org?.id) return
    void load(org.id)
  }, [org?.id])

  async function load(orgId: string) {
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('org_modules')
      .select('module_key, is_enabled')
      .eq('org_id', orgId)
    if (fetchError) {
      setError(fetchError.message)
      return
    }
    const map: Record<string, boolean> = {}
    for (const moduleItem of MODULE_LIST) map[moduleItem.key] = Boolean(moduleItem.alwaysOn)
    for (const row of data ?? []) map[row.module_key] = Boolean(row.is_enabled)
    setEnabled(map)
  }

  async function toggle(moduleKey: string, nextValue: boolean) {
    if (!org?.id || !canEdit) return
    setSavingKey(moduleKey)
    setError('')
    const result = await toggleModule({
      org_id: org.id,
      module_key: moduleKey,
      enabled: nextValue,
    })

    setSavingKey('')
    if (!result.ok) {
      setError(result.message)
      return
    }
    setEnabled((prev) => ({ ...prev, [moduleKey]: nextValue }))
  }

  const modules = useMemo(() => MODULE_LIST, [])

  return (
    <>
      <PageHeader title="Modules" description="Enable or disable modules at organisation level." />
      {!org && <Card><p style={{ margin: 0, color: 'var(--text-secondary)' }}>Organisation context is missing for this user.</p></Card>}
      {org && (
        <section className="grid">
          {modules.map((moduleItem) => {
            const on = enabled[moduleItem.key] ?? Boolean(moduleItem.alwaysOn)
            const locked = Boolean(moduleItem.alwaysOn)
            return (
              <Card key={moduleItem.key}>
                <div className="row">
                  <div>
                    <h3>{moduleItem.label} {moduleItem.comingSoon && <Badge variant="warning">Coming Soon</Badge>}</h3>
                    <p>{moduleItem.description}</p>
                  </div>
                  <Badge variant={on ? 'success' : 'slate'}>{on ? 'Enabled' : 'Disabled'}</Badge>
                </div>
                <div className="actions">
                  <Button
                    title={!canEdit ? 'You do not have permission to edit configuration.' : undefined}
                    size="sm"
                    variant={on ? 'outline' : 'primary'}
                    disabled={!canEdit || locked}
                    loading={savingKey === moduleItem.key}
                    onClick={() => toggle(moduleItem.key, !on)}
                  >
                    {on ? 'Disable' : 'Enable'}
                  </Button>
                  {locked && <span className="hint">Always on</span>}
                </div>
              </Card>
            )
          })}
        </section>
      )}
      {error && <p className="error">{error}</p>}
      <style jsx>{`
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
        .row { display: flex; justify-content: space-between; gap: var(--space-3); }
        h3 { margin: 0; font-size: var(--text-base); display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
        p { margin: var(--space-1) 0 0; color: var(--text-secondary); font-size: var(--text-sm); }
        .actions { margin-top: var(--space-4); display: flex; align-items: center; gap: var(--space-2); }
        .hint { color: var(--text-secondary); font-size: var(--text-xs); }
        .error { margin-top: var(--space-4); color: var(--text-danger); }
        @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </>
  )
}





