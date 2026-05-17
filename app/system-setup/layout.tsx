import { redirect } from 'next/navigation'
import SystemSetupShell from '@/components/system-setup/SystemSetupShell'
import { createClient } from '@/lib/supabase.server'

function displayName(user: any) {
  return user?.full_name ?? [user?.first_name, user?.last_name].filter(Boolean).join(' ') ?? user?.email ?? 'Admin'
}

function roleName(user: any, roleRows: any[]) {
  return String(user?.role ?? roleRows?.[0]?.roles?.role_name ?? user?.roles?.role_name ?? '').toLowerCase()
}

export default async function SystemSetupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: appUser } = await supabase
    .from('users')
    .select('*, organisations(name), business_units(name), roles(role_name, name, label)')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (!appUser || appUser.is_active === false) redirect('/dashboard')

  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role_id, roles(role_name, name, label)')
    .eq('user_id', auth.user.id)
    .eq('is_active', true)

  const names = [
    roleName(appUser, roleRows ?? []),
    ...((roleRows ?? []).map((row: any) => String(row.roles?.role_name ?? row.roles?.name ?? row.roles?.label ?? '').toLowerCase())),
  ]

  if (!names.includes('superadmin') && !names.includes('admin')) redirect('/dashboard')

  return (
    <SystemSetupShell
      user={{
        name: displayName(appUser),
        email: appUser.email ?? auth.user.email ?? '',
        role: names.includes('superadmin') ? 'superadmin' : 'admin',
        orgName: appUser.organisations?.name ?? 'No organisation',
        businessUnitName: appUser.business_units?.name ?? 'No Business Unit',
      }}
    >
      {children}
    </SystemSetupShell>
  )
}
