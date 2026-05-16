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

export default function EmployeesPage() {
  const { tenant, permissions } = useAuth()
  const { error: notifyError } = useToast()
  const canCreate = permissions?.is_admin || permissions?.module_permissions.hr?.can_create
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ employee_code: '', full_name: '', phone: '', designation: '', department: '', date_of_joining: new Date().toISOString().split('T')[0] })
  useEffect(() => { if (!tenant?.id) { setLoading(false); return } ; void load(tenant.id) }, [tenant?.id])
  async function load(tenantId: string) {
    const supabase = getSupabaseClient()
    const { data, error: fetchError } = await supabase.from('employees').select('id, employee_code, full_name, phone, designation, department, date_of_joining, is_active').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    if (fetchError) setError(fetchError.message)
    setRows(data ?? [])
    setLoading(false)
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!tenant?.id || !canCreate) return
    setSaving(true); setError('')
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from('employees').insert({ tenant_id: tenant.id, employee_code: form.employee_code.trim(), full_name: form.full_name.trim(), phone: form.phone.trim() || null, designation: form.designation.trim() || null, department: form.department.trim() || null, date_of_joining: form.date_of_joining, is_active: true }).select('id').single()
    setSaving(false)
    if (handleSupabaseError(error, notifyError)) { setError(error?.message ?? 'Failed to create employee.'); return }
    if (!data) return
    setForm({ employee_code: '', full_name: '', phone: '', designation: '', department: '', date_of_joining: new Date().toISOString().split('T')[0] })
    await load(tenant.id)
  }
  if (!tenant) return <TenantSetupNotice title="Employees" description="Select or create a factory before creating employees." />
  const columns: Column<any>[] = useMemo(() => [
    { key: 'employee_code', header: 'Code' }, { key: 'full_name', header: 'Name' }, { key: 'phone', header: 'Phone', render: (v) => v || '-' }, { key: 'designation', header: 'Designation', render: (v) => v || '-' }, { key: 'department', header: 'Department', render: (v) => v || '-' }, { key: 'is_active', header: 'Status', render: (v) => <Badge variant={v ? 'success' : 'slate'}>{v ? 'Active' : 'Inactive'}</Badge> },
  ], [])
  return <>
    <PageHeader title="Employees" description={`Employee records for ${tenant.name}.`} />
    <section className="layout">
      <Card><h2>Add Employee</h2><form onSubmit={create}>
        <Input label="Employee code" value={form.employee_code} onChange={(e) => setForm((p) => ({ ...p, employee_code: e.target.value }))} required disabled={!canCreate} />
        <Input label="Full name" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} required disabled={!canCreate} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} disabled={!canCreate} />
        <Input label="Designation" value={form.designation} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} disabled={!canCreate} />
        <Input label="Department" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} disabled={!canCreate} />
        <Input label="Date of joining" type="date" value={form.date_of_joining} onChange={(e) => setForm((p) => ({ ...p, date_of_joining: e.target.value }))} disabled={!canCreate} />
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" loading={saving} disabled={!canCreate} fullWidth>Add employee</Button>
      </form></Card>
      <DataTable columns={columns} data={rows} loading={loading} emptyTitle="No employees found" emptyMessage="Add employee master records." searchable searchPlaceholder="Search employees..." />
    </section>
    <style jsx>{`.layout{display:grid;grid-template-columns:360px minmax(0,1fr);gap:var(--space-6)} form{display:flex;flex-direction:column;gap:var(--space-4)} .form-error{margin:0;color:var(--text-danger)} @media(max-width:920px){.layout{grid-template-columns:1fr}}`}</style>
  </>
}
