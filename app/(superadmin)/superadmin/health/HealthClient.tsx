'use client'

import { useState, useTransition } from 'react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { superadminHealth } from '@/app/actions/superadmin'
import type { HealthCheckResult } from '@/app/actions/superadmin/health'

const manualChecks = [
  '/superadmin route loads and shows dashboard',
  'Superadmin can create an organisation',
  'Superadmin can create a user with login credentials',
  'Superadmin can edit role permissions and save',
  'Superadmin can impersonate a user',
  'Regular admin CANNOT access /superadmin route (returns 403)',
  'Regular staff CANNOT see create/edit/delete buttons on guarded pages',
  'Audit log shows entries after each superadmin action',
]

const groups: HealthCheckResult['group'][] = ['DATABASE CHECKS', 'AUTH CHECKS', 'SERVER ACTION CHECKS']

export default function HealthClient({ initialResults }: { initialResults: HealthCheckResult[] }) {
  const [results, setResults] = useState(initialResults)
  const [manual, setManual] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function runAll() {
    setError('')
    startTransition(async () => {
      const response = await superadminHealth.runHealthChecks()
      if (response.error || !response.data) {
        setError(response.error ?? 'Health checks failed.')
        return
      }
      setResults(response.data)
    })
  }

  const passed = results.filter((result) => result.passed).length
  const failed = results.length - passed

  return (
    <div className="health-page">
      <div className="org-page__header">
        <div>
          <h1>Health Check</h1>
          <p>Run automated platform checks and track manual UAT validation.</p>
        </div>
        <Button loading={isPending} onClick={runAll}>Run All Checks</Button>
      </div>

      <div className="health-summary">
        <Badge variant="success">{passed} passed</Badge>
        <Badge variant={failed ? 'danger' : 'slate'}>{failed} failed</Badge>
      </div>

      {error && <div className="form-error">{error}</div>}

      {groups.map((group) => (
        <section key={group} className="health-section">
          <h2>{group}</h2>
          <div className="health-checklist">
            {results.filter((result) => result.group === group).map((result) => (
              <div key={result.id} className={`health-check ${result.passed ? 'pass' : 'fail'}`}>
                <span className="health-check__icon">{result.passed ? '✓' : '×'}</span>
                <div>
                  <strong>{result.label}</strong>
                  <p>{result.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="health-section">
        <h2>UI CHECKS</h2>
        <div className="health-checklist">
          {manualChecks.map((label) => (
            <label key={label} className="manual-check">
              <input
                type="checkbox"
                checked={Boolean(manual[label])}
                onChange={(event) => setManual((current) => ({ ...current, [label]: event.target.checked }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}





