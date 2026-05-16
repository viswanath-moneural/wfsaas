import { AuthProvider } from '@/lib/AuthContext'
import AppShell from '@/components/layout/AppShell'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  )
}





