'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/lib/hooks/useToast'
import { deleteDataBond, deleteDataPoint, deleteDataRule, upsertDataBond, upsertDataPoint, upsertDataRule, upsertScreenDesign } from '@/app/actions/systemSetup/elementEngine'

const tabs = [
  { key: 'overview', label: 'Overview', suffix: '' },
  { key: 'data-points', label: 'Data Points', suffix: '/data-points' },
  { key: 'data-bonds', label: 'Data Bonds', suffix: '/data-bonds' },
  { key: 'data-rules', label: 'Data Rules', suffix: '/data-rules' },
  { key: 'screen-designs', label: 'Screen Designs', suffix: '/screen-designs' },
  { key: 'record-types', label: 'Record Types', suffix: '/record-types' },
  { key: 'preview', label: 'Element Page', suffix: '/preview' },
]

export default function ElementDetailShell({
  detail,
  section,
}: {
  detail: any
  section: 'overview' | 'data-points' | 'data-bonds' | 'data-rules' | 'screen-designs' | 'record-types'
}) {
  const toast = useToast()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [pointForm, setPointForm] = useState({ api_name: '', label: '', field_type: 'text' })
  const [bondForm, setBondForm] = useState({ api_name: '', label: '', target_element_id: '' })
  const [ruleForm, setRuleForm] = useState({ api_name: '', label: '', error_message: '', expression: '{"type":"always_true"}' })
  const [screenForm, setScreenForm] = useState({ layout_name: 'Default Screen', sections: '[]' })

  function createDataPoint(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await upsertDataPoint({
        element_id: detail.element.id,
        api_name: pointForm.api_name,
        label: pointForm.label,
        data_point_type: detail.element.is_core ? 'core' : 'adaptive',
        field_type: pointForm.field_type,
        is_required: false,
        is_unique: false,
        is_readonly: false,
        is_active: true,
      })
      if (result.error) toast.error(result.error)
      else {
        toast.success('Data Point created.')
        location.reload()
      }
    })
  }

  function createDataBond(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await upsertDataBond({
        source_element_id: detail.element.id,
        target_element_id: bondForm.target_element_id,
        bond_type: 'lookup',
        api_name: bondForm.api_name,
        label: bondForm.label,
        is_active: true,
      })
      if (result.error) toast.error(result.error)
      else {
        toast.success('Data Bond created.')
        location.reload()
      }
    })
  }

  function createDataRule(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      let expression: any = {}
      try {
        expression = JSON.parse(ruleForm.expression)
      } catch {
        toast.error('Expression must be valid JSON.')
        return
      }
      const result = await upsertDataRule({
        element_id: detail.element.id,
        api_name: ruleForm.api_name,
        label: ruleForm.label,
        error_message: ruleForm.error_message,
        expression,
        is_active: true,
      })
      if (result.error) toast.error(result.error)
      else {
        toast.success('Data Rule created.')
        location.reload()
      }
    })
  }

  function createScreenDesign(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      let sections: any[] = []
      try {
        sections = JSON.parse(screenForm.sections)
      } catch {
        toast.error('Sections must be valid JSON array.')
        return
      }
      const result = await upsertScreenDesign({
        element_id: detail.element.id,
        layout_name: screenForm.layout_name,
        sections,
        is_default: true,
        is_active: true,
      })
      if (result.error) toast.error(result.error)
      else {
        toast.success('Screen Design saved.')
        location.reload()
      }
    })
  }

  return (
    <div className="stack">
      <Card>
        <div className="heading">
          <div>
            <Link href="/system-setup/elements">Back to Element Manager</Link>
            <h1>{detail.element.label}</h1>
            <p>{detail.element.api_name}</p>
          </div>
          <div className="badges">
            <Badge variant={detail.element.element_type === 'core' ? 'primary' : 'success'}>{detail.element.element_type}</Badge>
            <Badge variant={detail.element.is_active ? 'success' : 'slate'}>{detail.element.is_active ? 'active' : 'inactive'}</Badge>
          </div>
        </div>
        <div className="tabs">
          {tabs.map((tab) => (
            <Link className={pathname.endsWith(tab.suffix || detail.element.id) && section === tab.key ? 'active' : section === tab.key ? 'active' : ''} key={tab.key} href={`/system-setup/elements/${detail.element.id}${tab.suffix}`}>
              {tab.label}
            </Link>
          ))}
        </div>
      </Card>

      {section === 'overview' && (
        <Card>
          <p>Element Engine metadata summary.</p>
          <ul>
            <li>Data Points: {detail.dataPoints.length}</li>
            <li>Data Bonds: {detail.dataBonds.length}</li>
            <li>Data Rules: {detail.dataRules.length}</li>
            <li>Record Types: {detail.recordTypes.length}</li>
            <li>Screen Designs: {detail.screenDesigns.length}</li>
          </ul>
        </Card>
      )}

      {section === 'data-points' && (
        <Card>
          <form className="form-grid" onSubmit={createDataPoint}>
            <Input required placeholder="api_name" value={pointForm.api_name} onChange={(event) => setPointForm((prev) => ({ ...prev, api_name: event.target.value.toLowerCase() }))} />
            <Input required placeholder="Label" value={pointForm.label} onChange={(event) => setPointForm((prev) => ({ ...prev, label: event.target.value }))} />
            <select value={pointForm.field_type} onChange={(event) => setPointForm((prev) => ({ ...prev, field_type: event.target.value }))}>
              {['text', 'number', 'date', 'datetime', 'boolean', 'picklist', 'lookup', 'formula', 'currency', 'email', 'phone', 'textarea', 'json'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <Button type="submit" loading={isPending}>Add Data Point</Button>
          </form>
          <table className="table">
            <thead><tr><th>Label</th><th>api_name</th><th>type</th><th /></tr></thead>
            <tbody>
              {detail.dataPoints.map((row: any) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.api_name}</td>
                  <td>{row.field_type}</td>
                  <td><Button size="xs" variant="danger" onClick={() => startTransition(async () => { await deleteDataPoint(row.id); location.reload() })}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {section === 'data-bonds' && (
        <Card>
          <form className="form-grid" onSubmit={createDataBond}>
            <Input required placeholder="api_name" value={bondForm.api_name} onChange={(event) => setBondForm((prev) => ({ ...prev, api_name: event.target.value.toLowerCase() }))} />
            <Input required placeholder="Label" value={bondForm.label} onChange={(event) => setBondForm((prev) => ({ ...prev, label: event.target.value }))} />
            <select required value={bondForm.target_element_id} onChange={(event) => setBondForm((prev) => ({ ...prev, target_element_id: event.target.value }))}>
              <option value="">Target Element</option>
              {detail.allElements.map((row: any) => <option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
            <Button type="submit" loading={isPending}>Add Data Bond</Button>
          </form>
          <table className="table">
            <thead><tr><th>Label</th><th>api_name</th><th>bond_type</th><th /></tr></thead>
            <tbody>
              {detail.dataBonds.map((row: any) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.api_name}</td>
                  <td>{row.bond_type}</td>
                  <td><Button size="xs" variant="danger" onClick={() => startTransition(async () => { await deleteDataBond(row.id); location.reload() })}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {section === 'data-rules' && (
        <Card>
          <form className="form-grid" onSubmit={createDataRule}>
            <Input required placeholder="api_name" value={ruleForm.api_name} onChange={(event) => setRuleForm((prev) => ({ ...prev, api_name: event.target.value.toLowerCase() }))} />
            <Input required placeholder="Label" value={ruleForm.label} onChange={(event) => setRuleForm((prev) => ({ ...prev, label: event.target.value }))} />
            <Input required placeholder="Error message" value={ruleForm.error_message} onChange={(event) => setRuleForm((prev) => ({ ...prev, error_message: event.target.value }))} />
            <textarea rows={6} value={ruleForm.expression} onChange={(event) => setRuleForm((prev) => ({ ...prev, expression: event.target.value }))} />
            <Button type="submit" loading={isPending}>Add Data Rule</Button>
          </form>
          <table className="table">
            <thead><tr><th>Label</th><th>api_name</th><th>error_message</th><th /></tr></thead>
            <tbody>
              {detail.dataRules.map((row: any) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.api_name}</td>
                  <td>{row.error_message}</td>
                  <td><Button size="xs" variant="danger" onClick={() => startTransition(async () => { await deleteDataRule(row.id); location.reload() })}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {section === 'screen-designs' && (
        <Card>
          <form className="form-grid" onSubmit={createScreenDesign}>
            <Input required placeholder="Layout name" value={screenForm.layout_name} onChange={(event) => setScreenForm((prev) => ({ ...prev, layout_name: event.target.value }))} />
            <textarea rows={8} value={screenForm.sections} onChange={(event) => setScreenForm((prev) => ({ ...prev, sections: event.target.value }))} />
            <Button type="submit" loading={isPending}>Save Screen Design</Button>
          </form>
          <table className="table">
            <thead><tr><th>layout_name</th><th>is_default</th><th>updated_at</th></tr></thead>
            <tbody>
              {detail.screenDesigns.map((row: any) => (
                <tr key={row.id}><td>{row.layout_name}</td><td>{row.is_default ? 'yes' : 'no'}</td><td>{row.updated_at ? new Date(row.updated_at).toLocaleString() : '-'}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {section === 'record-types' && (
        <Card>
          <p>Record Types are enabled in schema and visible here. CRUD UI can be expanded next; current version reads available record types from metadata.</p>
          <table className="table">
            <thead><tr><th>Label</th><th>api_name</th><th>default</th></tr></thead>
            <tbody>
              {detail.recordTypes.map((row: any) => (
                <tr key={row.id}><td>{row.label}</td><td>{row.api_name}</td><td>{row.is_default ? 'yes' : 'no'}</td></tr>
              ))}
              {!detail.recordTypes.length && <tr><td colSpan={3}>No record types yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      <style jsx>{`
        .stack {
          display: grid;
          gap: var(--space-4);
        }
        .heading {
          display: flex;
          justify-content: space-between;
          gap: var(--space-3);
        }
        .heading h1 {
          margin: var(--space-1) 0 0;
        }
        .heading p {
          margin: var(--space-1) 0 0;
          color: var(--text-secondary);
        }
        .badges {
          display: flex;
          gap: var(--space-2);
          align-items: flex-start;
        }
        .tabs {
          margin-top: var(--space-4);
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
        }
        .tabs a {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          padding: 6px 12px;
          color: var(--text-secondary);
          text-decoration: none;
          font-size: var(--text-sm);
        }
        .tabs a.active,
        .tabs a:hover {
          background: var(--color-primary-50);
          color: var(--color-primary-700);
          border-color: var(--color-primary-500);
        }
        .form-grid {
          display: grid;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }
        textarea, select {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: var(--space-2);
          font: inherit;
          background: var(--surface-card);
        }
        .table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: var(--space-2) var(--space-1);
          border-bottom: 1px solid var(--border-default);
          text-align: left;
        }
      `}</style>
    </div>
  )
}
