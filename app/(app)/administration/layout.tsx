import { redirect } from 'next/navigation'
import AdministrationShell from '@/components/layout/AdministrationShell'
import { requireOrgAdmin } from '@/lib/auth/guards'

export default async function AdministrationLayout({ children }: { children: React.ReactNode }) {
  let user
  try {
    user = await requireOrgAdmin()
  } catch {
    redirect('/dashboard')
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email

  return (
    <AdministrationShell
      user={{
        name,
        email: user.email,
        role: user.role?.label ?? user.role?.name ?? 'Admin',
      }}
    >
      {children}
    </AdministrationShell>
  )
}
