import Link from 'next/link'
import { redirect } from 'next/navigation'
import SuperadminSidebar from '@/components/layout/SuperadminSidebar'
import { requireSuperadmin } from '@/lib/auth/requireSuperadmin'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  let verified
  try {
    verified = await requireSuperadmin()
  } catch {
    redirect('/login')
  }

  return (
    <div className="superadmin-shell">
      <SuperadminSidebar />
      <div className="superadmin-shell__main">
        <header className="superadmin-shell__topbar">
          <strong>Superadmin Console</strong>
          <div>
            <span>{verified.appUser.full_name ?? verified.appUser.email ?? verified.authUser.email}</span>
            <Link href="/dashboard">Exit to App</Link>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
