'use client'

import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/Card'
import DataTable, { type Column } from '@/components/DataTable'
import PageHeader from '@/components/layout/PageHeader'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import TenantSetupNotice from '@/components/layout/TenantSetupNotice'
import { useAuth } from '@/lib/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'

export default function AttendancePage() {
  const { tenant, permissions } = useAuth()
  const canCreate = permissions?.is_admin || permissions?.module_permissions.hr?.can_create
  const [rows, setRows] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ employee_id: '', attendance_date: new Date().toISOString().split('T')[0], shift: 'general', status: 'present', in_time: '', out_time: '', notes: '' })
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: attData, error: attError }, { data: empData }] = await Promise.all([
      supabase.from('attendance').select('id, attendance_date, shift, status, in_time, out_time, employees(full_name, employee_code)').eq('tenant_id', tenantId).order('attendance_date', { ascending: false }),
      supabase.from('employees').select('id, employee_code, full_name').eq('tenant_id', tenantId).eq('is_active', true).order('full_name', { ascending: true }),
    ])
    if (attError) setError(attError.message)
    setRows(attData ?? [])
    setEmployees(empData ?? [])
    setLoading(false)
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id || !canCreate) return
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const { error: insertError } = await supabase.from('attendance').insert({ tenant_id: tenant.id, employee_id: form.employee_id || null, attendance_date: form.attendance_date, shift: form.shift as any, status: form.status, in_time: form.in_time || null, out_time: form.out_time || null, notes: form.notes || null })
    setSaving(false)
    if (insertError) { setError(insertError.message); return }
    setForm({ employee_id: '', attendance_date: new Date().toISOString().split('T')[0], shift: 'general', status: 'present', in_time: '', out_time: '', notes: '' })
    await load(tenant.id)
  }
  if (!tenant) return <TenantSetupNotice title="Attendance" description="Select or create a factory before recording attendance." />
  const columns: Column<any>[] = useMemo(() => [
    { key: 'attendance_date', header: 'Date' }, { key: 'employees', header: 'Employee', render: (_v, r) => `${r.employees?.employee_code ?? ''} ${r.employees?.full_name ?? ''}`.trim() || '-' }, { key: 'shift', header: 'Shift' }, { key: 'status', header: 'Status', render: (v) => <Badge variant="info">{v || '-'}</Badge> }, { key: 'in_time', header: 'In', render: (v) => v || '-' }, { key: 'out_time', header: 'Out', render: (v) => v || '-' },
  ], [])
  return <>
    <PageHeader title="Attendance" description={`Daily attendance for ${tenant.name}.`} />
    <section className="layout">
      <Card><h2>Mark Attendance</h2><form onSubmit={create}>
        <label><span>Employee</span><select value={form.employee_id} onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))} disabled={!canCreate}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_code} - {employee.full_name}</option>)}</select></label>
        <Input label="Date" type="date" value={form.attendance_date} onChange={(e) => setForm((p) => ({ ...p, attendance_date: e.target.value }))} disabled={!canCreate} />
        <Input label="Shift" value={form.shift} onChange={(e) => setForm((p) => ({ ...p, shift: e.target.value }))} disabled={!canCreate} />
        <Input label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} disabled={!canCreate} />
        <Input label="In time" type="time" value={form.in_time} onChange={(e) => setForm((p) => ({ ...p, in_time: e.target.value }))} disabled={!canCreate} />
        <Input label="Out time" type="time" value={form.out_time} onChange={(e) => setForm((p) => ({ ...p, out_time: e.target.value }))} disabled={!canCreate} />
        <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} disabled={!canCreate} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate} fullWidth>Save attendance</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No attendance records" emptyMessage="Mark attendance entries." searchable searchPlaceholder="Search attendance..." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} select{height:var(--input-height-md)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
