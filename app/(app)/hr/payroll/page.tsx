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
import { handleSupabaseError } from '@/lib/handleSupabaseError'
import { useToast } from '@/lib/hooks/useToast'
import { getSupabaseClient } from '@/lib/supabase'
import { formatMoney } from '@/lib/transactions'

export default function PayrollPage() {
  const { tenant, permissions } = useAuth()
  const { error: notifyError } = useToast()
  const canCreate = permissions?.is_admin || permissions?.module_permissions.hr?.can_create
  const [rows, setRows] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ employee_id: '', month_year: '', days_present: '0', overtime_hours: '0', gross_pay: '0', deductions: '0', status: 'draft' })
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const [{ data: runData, error: runError }, { data: empData }] = await Promise.all([
      supabase.from('payroll_runs').select('id, month_year, days_present, overtime_hours, gross_pay, deductions, net_pay, status, employees(employee_code, full_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, employee_code, full_name').eq('tenant_id', tenantId).eq('is_active', true).order('full_name', { ascending: true }),
    ])
    if (runError) setError(runError.message)
    setRows(runData ?? [])
    setEmployees(empData ?? [])
    setLoading(false)
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id || !canCreate) return
    setSaving(true); setError('')
    const gross = Number(form.gross_pay)
    const deductions = Number(form.deductions)
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('payroll_runs').insert({ tenant_id: tenant.id, employee_id: form.employee_id || null, month_year: form.month_year, days_present: Number(form.days_present), overtime_hours: Number(form.overtime_hours), gross_pay: gross, deductions, net_pay: gross - deductions, status: form.status }).select('id').single()
    setSaving(false)
    if (handleSupabaseError(error, notifyError)) { setError(error?.message ?? 'Failed to save payroll.'); return }
    if (!data) return
    setForm({ employee_id: '', month_year: '', days_present: '0', overtime_hours: '0', gross_pay: '0', deductions: '0', status: 'draft' })
    await load(tenant.id)
  }
  if (!tenant) return <TenantSetupNotice title="Payroll" description="Select or create a factory before running payroll." />
  const columns: Column<any>[] = useMemo(() => [
    { key: 'month_year', header: 'Month' }, { key: 'employees', header: 'Employee', render: (_v, r) => `${r.employees?.employee_code ?? ''} ${r.employees?.full_name ?? ''}`.trim() || '-' }, { key: 'gross_pay', header: 'Gross', align: 'right', render: (v) => formatMoney(Number(v ?? 0)) }, { key: 'deductions', header: 'Deductions', align: 'right', render: (v) => formatMoney(Number(v ?? 0)) }, { key: 'net_pay', header: 'Net', align: 'right', render: (v) => formatMoney(Number(v ?? 0)) }, { key: 'status', header: 'Status', render: (v) => <Badge variant="info">{v || '-'}</Badge> },
  ], [])
  return <>
    <PageHeader title="Payroll" description={`Payroll runs for ${tenant.name}.`} />
    <section className="layout">
      <Card><h2>Create Payroll Entry</h2><form onSubmit={create}>
        <label><span>Employee</span><select value={form.employee_id} onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))} disabled={!canCreate}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_code} - {employee.full_name}</option>)}</select></label>
        <Input label="Month (YYYY-MM)" value={form.month_year} onChange={(e) => setForm((p) => ({ ...p, month_year: e.target.value }))} required disabled={!canCreate} />
        <Input label="Days present" type="number" value={form.days_present} onChange={(e) => setForm((p) => ({ ...p, days_present: e.target.value }))} disabled={!canCreate} />
        <Input label="Overtime hours" type="number" value={form.overtime_hours} onChange={(e) => setForm((p) => ({ ...p, overtime_hours: e.target.value }))} disabled={!canCreate} />
        <Input label="Gross pay" type="number" value={form.gross_pay} onChange={(e) => setForm((p) => ({ ...p, gross_pay: e.target.value }))} disabled={!canCreate} />
        <Input label="Deductions" type="number" value={form.deductions} onChange={(e) => setForm((p) => ({ ...p, deductions: e.target.value }))} disabled={!canCreate} />
        <Input label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} disabled={!canCreate} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate} fullWidth>Save payroll</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No payroll entries" emptyMessage="Create payroll entries by month." searchable searchPlaceholder="Search payroll..." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} label{display:flex;flex-direction:column;gap:var(--space-1-5)} select{height:var(--input-height-md)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
