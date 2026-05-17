'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Switch from '@/components/ui/Switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableStyles } from '@/components/ui/Table'
import { saveFieldPermissions, saveModulePermissions } from '@/app/actions/systemSetup/roles'

const MODULE_KEYS = [
  ['can_create', 'Create'],
  ['can_read', 'Read'],
  ['can_update', 'Update'],
  ['can_delete', 'Delete'],
] as const

function roleLabel(role: any) {
  return role.label ?? role.role_name ?? role.name ?? 'Untitled role'
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildModuleRows(modules: string[], permissions: any[]) {
  return modules.map((moduleKey) => {
    const existing = permissions.find((permission) => permission.module_key === moduleKey)
    return {
      module_key: moduleKey,
      can_create: Boolean(existing?.can_create),
      can_read: Boolean(existing?.can_read),
      can_update: Boolean(existing?.can_update),
      can_delete: Boolean(existing?.can_delete),
    }
  })
}

function buildFieldRows(table: { key: string; fields: string[] }, permissions: any[]) {
  return table.fields.map((fieldName) => {
    const existing = permissions.find((permission) => permission.table_name === table.key && permission.field_name === fieldName)
    return {
      field_name: fieldName,
      can_view: Boolean(existing?.can_view),
      can_edit: Boolean(existing?.can_edit),
    }
  })
}

export default function RoleDetailClient({ data }: { data: any }) {
  const [tab, setTab] = useState('modules')
  const [moduleRows, setModuleRows] = useState(() => buildModuleRows(data.modules, data.modulePermissions))
  const [initialModuleRows, setInitialModuleRows] = useState(() => buildModuleRows(data.modules, data.modulePermissions))
  const [selectedTable, setSelectedTable] = useState(data.fieldTables[0]?.key ?? '')
  const [fieldRowsByTable, setFieldRowsByTable] = useState<Record<string, any[]>>(() => Object.fromEntries(data.fieldTables.map((table: any) => [table.key, buildFieldRows(table, data.fieldPermissions)])))
  const [initialFieldRowsByTable, setInitialFieldRowsByTable] = useState<Record<string, any[]>>(() => Object.fromEntries(data.fieldTables.map((table: any) => [table.key, buildFieldRows(table, data.fieldPermissions)])))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const moduleDirty = JSON.stringify(moduleRows) !== JSON.stringify(initialModuleRows)
  const fieldDirty = JSON.stringify(fieldRowsByTable[selectedTable] ?? []) !== JSON.stringify(initialFieldRowsByTable[selectedTable] ?? [])
  const selectedTableMeta = data.fieldTables.find((table: any) => table.key === selectedTable)
  const fieldRows = fieldRowsByTable[selectedTable] ?? []

  function toggleModule(moduleKey: string, key: typeof MODULE_KEYS[number][0], checked: boolean) {
    setModuleRows((current) => current.map((row) => row.module_key === moduleKey ? { ...row, [key]: checked } : row))
  }

  function toggleField(fieldName: string, key: 'can_view' | 'can_edit', checked: boolean) {
    setFieldRowsByTable((current) => ({
      ...current,
      [selectedTable]: (current[selectedTable] ?? []).map((row) => row.field_name === fieldName ? { ...row, [key]: checked } : row),
    }))
  }

  function bulkField(key: 'can_view' | 'can_edit', checked: boolean) {
    setFieldRowsByTable((current) => ({
      ...current,
      [selectedTable]: (current[selectedTable] ?? []).map((row) => ({ ...row, [key]: checked })),
    }))
  }

  function saveModules() {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await saveModulePermissions(data.role.id, moduleRows)
      if (result.error) {
        setError(result.error)
        return
      }
      setInitialModuleRows(moduleRows)
      setMessage('Module permissions saved.')
    })
  }

  function saveFields() {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await saveFieldPermissions(data.role.id, selectedTable, fieldRows)
      if (result.error) {
        setError(result.error)
        return
      }
      setInitialFieldRowsByTable((current) => ({ ...current, [selectedTable]: fieldRows }))
      setMessage('Field permissions saved.')
    })
  }

  const title = useMemo(() => roleLabel(data.role), [data.role])

  return (
    <div className="role-detail">
      <div className="detail-header">
        <div>
          <Link href="/system-setup/roles">Back to roles</Link>
          <h1>{title}</h1>
          <p>{data.role.description ?? 'No description'}</p>
        </div>
        <div className="header-meta">
          <Badge variant={data.role.is_system ? 'slate' : 'primary'}>{data.role.is_system ? 'System' : 'Custom'}</Badge>
          <span>{data.userCount} users assigned</span>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="modules">Module Permissions</TabsTrigger>
          <TabsTrigger value="fields">Field Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="modules">
          <div className="permission-toolbar">
            <span className={moduleDirty ? 'dirty' : ''}>{moduleDirty ? 'Unsaved changes' : 'All changes saved'}</span>
            <Button loading={isPending} disabled={!moduleDirty} onClick={saveModules}>Save Module Permissions</Button>
          </div>
          <div className="setup-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  {MODULE_KEYS.map(([, label]) => <TableHead key={label}>{label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {moduleRows.map((row) => (
                  <TableRow key={row.module_key} className={JSON.stringify(row) !== JSON.stringify(initialModuleRows.find((item) => item.module_key === row.module_key)) ? 'row-dirty' : ''}>
                    <TableCell><strong>{humanize(row.module_key)}</strong></TableCell>
                    {MODULE_KEYS.map(([key]) => (
                      <TableCell key={key}>
                        <Switch checked={Boolean(row[key])} onCheckedChange={(checked) => toggleModule(row.module_key, key, checked)} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="fields">
          <div className="permission-toolbar">
            <div className="table-select">
              <span>Module/Table</span>
              <Select value={selectedTable} onChange={(event) => setSelectedTable(event.target.value)}>
                {data.fieldTables.map((table: any) => <option key={table.key} value={table.key}>{table.label}</option>)}
              </Select>
            </div>
            <div className="row-actions">
              <Button variant="outline" onClick={() => bulkField('can_view', true)}>Grant All View</Button>
              <Button variant="outline" onClick={() => bulkField('can_edit', false)}>Revoke All Edit</Button>
              <span className={fieldDirty ? 'dirty' : ''}>{fieldDirty ? 'Unsaved changes' : 'All changes saved'}</span>
              <Button loading={isPending} disabled={!fieldDirty || !selectedTableMeta} onClick={saveFields}>Save Field Permissions</Button>
            </div>
          </div>
          <div className="setup-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>View</TableHead>
                  <TableHead>Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldRows.map((row) => (
                  <TableRow key={row.field_name} className={JSON.stringify(row) !== JSON.stringify((initialFieldRowsByTable[selectedTable] ?? []).find((item) => item.field_name === row.field_name)) ? 'row-dirty' : ''}>
                    <TableCell><strong>{humanize(row.field_name)}</strong><br /><small>{row.field_name}</small></TableCell>
                    <TableCell><Switch checked={row.can_view} onCheckedChange={(checked) => toggleField(row.field_name, 'can_view', checked)} /></TableCell>
                    <TableCell><Switch checked={row.can_edit} onCheckedChange={(checked) => toggleField(row.field_name, 'can_edit', checked)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <TableStyles />
      <style jsx>{`
        .detail-header {
          display: flex;
          justify-content: space-between;
          gap: var(--space-4);
          margin-bottom: var(--space-5);
        }
        .detail-header a {
          color: var(--color-primary-700);
          font-size: var(--text-sm);
          text-decoration: none;
        }
        h1 {
          margin: var(--space-2) 0 0;
          font-size: var(--text-2xl);
        }
        p {
          margin: var(--space-1) 0 0;
          color: var(--text-secondary);
        }
        .header-meta {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          color: var(--text-secondary);
        }
        .permission-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
        }
        .table-select {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }
        .row-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--space-2);
        }
        .dirty {
          color: var(--color-warning-700);
          font-weight: var(--font-semibold);
        }
        .setup-card {
          overflow: hidden;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--surface-card);
        }
        :global(.row-dirty .shad-table-cell) {
          background: var(--color-warning-50);
        }
        small {
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  )
}
