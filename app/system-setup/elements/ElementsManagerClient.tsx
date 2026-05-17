'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/lib/hooks/useToast'
import { upsertElement } from '@/app/actions/systemSetup/elementEngine'

type ElementRow = {
  id: string
  api_name: string
  label: string
  description: string | null
  element_type: string
  is_core: boolean
  storage_strategy: string
  physical_table_name: string | null
  is_active: boolean
}

export default function ElementsManagerClient({
  initialElements,
  businessUnits,
  selectedBusinessUnitId,
}: {
  initialElements: ElementRow[]
  businessUnits: Array<{ id: string; business_unit_name: string; is_active: boolean }>
  selectedBusinessUnitId: string | null
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initialElements)
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()
  const [form, setForm] = useState({
    api_name: '',
    label: '',
    description: '',
    element_type: 'adaptive' as 'core' | 'adaptive',
    storage_strategy: 'adaptive_json' as 'physical_table' | 'adaptive_json',
    physical_table_name: '',
    is_active: true,
  })

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => row.label.toLowerCase().includes(needle) || row.api_name.includes(needle))
  }, [rows, query])

  function createElement(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = await upsertElement({
        api_name: form.api_name,
        label: form.label,
        description: form.description || null,
        element_type: form.element_type,
        is_core: form.element_type === 'core',
        storage_strategy: form.storage_strategy,
        physical_table_name: form.physical_table_name || null,
        is_active: form.is_active,
        business_unit_id: selectedBusinessUnitId,
      })
      if (result.error || !result.data) {
        toast.error(result.error ?? 'Failed to create Element.')
        return
      }
      setRows((prev) => [result.data as ElementRow, ...prev])
      setForm({
        api_name: '',
        label: '',
        description: '',
        element_type: 'adaptive',
        storage_strategy: 'adaptive_json',
        physical_table_name: '',
        is_active: true,
      })
      toast.success('Element created.')
    })
  }

  return (
    <div className="elements-manager">
      <Card>
        <div className="header">
          <div>
            <h1>Element Manager</h1>
            <p>Manage Core Elements and Adaptive Elements for this organisation.</p>
          </div>
          <select
            value={selectedBusinessUnitId ?? ''}
            onChange={(event) => router.push(`/system-setup/elements?businessUnitId=${event.target.value}`)}
          >
            <option value="" disabled>Select Business Unit</option>
            {businessUnits.filter((row) => row.is_active).map((row) => (
              <option key={row.id} value={row.id}>{row.business_unit_name}</option>
            ))}
          </select>
          <Input placeholder="Search elements..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </Card>
      <Card>
        <form className="grid" onSubmit={createElement}>
          <Input placeholder="Element Label" value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} required />
          <Input placeholder="api_name" value={form.api_name} onChange={(event) => setForm((prev) => ({ ...prev, api_name: event.target.value.toLowerCase() }))} required />
          <Input placeholder="Description" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          <select value={form.element_type} onChange={(event) => setForm((prev) => ({ ...prev, element_type: event.target.value as 'core' | 'adaptive' }))}>
            <option value="core">Core Element</option>
            <option value="adaptive">Adaptive Element</option>
          </select>
          <select value={form.storage_strategy} onChange={(event) => setForm((prev) => ({ ...prev, storage_strategy: event.target.value as 'physical_table' | 'adaptive_json' }))}>
            <option value="physical_table">physical_table</option>
            <option value="adaptive_json">adaptive_json</option>
          </select>
          <Input placeholder="physical_table_name (optional)" value={form.physical_table_name} onChange={(event) => setForm((prev) => ({ ...prev, physical_table_name: event.target.value }))} />
          <Button type="submit" loading={isPending}>Create Element</Button>
        </form>
      </Card>
      <Card>
        <table className="table">
          <thead>
            <tr>
              <th>Element</th>
              <th>Type</th>
              <th>Storage</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.label}</strong>
                  <small>{row.api_name}</small>
                </td>
                <td><Badge variant={row.element_type === 'core' ? 'primary' : 'success'}>{row.element_type}</Badge></td>
                <td>{row.storage_strategy}{row.physical_table_name ? ` (${row.physical_table_name})` : ''}</td>
                <td><Badge variant={row.is_active ? 'success' : 'slate'}>{row.is_active ? 'active' : 'inactive'}</Badge></td>
                <td><Link href={`/system-setup/elements/${row.id}?businessUnitId=${selectedBusinessUnitId ?? ''}`}><Button size="xs" variant="outline">Open</Button></Link></td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={5}>No Elements found.</td></tr>}
          </tbody>
        </table>
      </Card>
      <style jsx>{`
        .elements-manager {
          display: grid;
          gap: var(--space-4);
        }
        .header {
          display: grid;
          gap: var(--space-3);
        }
        h1 {
          margin: 0;
          font-size: var(--text-xl);
        }
        p {
          margin: var(--space-1) 0 0;
          color: var(--text-secondary);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: var(--space-3);
        }
        .table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: var(--space-2) var(--space-1);
          border-bottom: 1px solid var(--border-default);
          text-align: left;
          vertical-align: top;
        }
        td strong {
          display: block;
        }
        td small {
          color: var(--text-secondary);
        }
        @media (max-width: 900px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
