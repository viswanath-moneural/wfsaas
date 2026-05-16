'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getSupabaseClient } from '@/lib/supabase'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell>Loading...</LoginShell>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const supabase = getSupabaseClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    router.replace(redirectTo)
    router.refresh()
  }

  return (
    <LoginShell>
        <div>
          <p className="auth-kicker">WFSAAS</p>
          <h1 id="login-title">Sign in</h1>
          <p className="auth-copy">Access your organisation workspace.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <Button type="submit" loading={loading} fullWidth>
            Sign in
          </Button>
        </form>
    </LoginShell>
  )
}

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">{children}</section>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: var(--space-6);
          background: var(--surface-page);
        }

        .auth-panel {
          width: min(100%, 420px);
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          padding: var(--space-8);
          background: var(--surface-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .auth-kicker {
          margin: 0 0 var(--space-2);
          font-size: var(--text-xs);
          font-weight: var(--font-bold);
          letter-spacing: var(--tracking-widest);
          color: var(--color-primary-600);
        }

        h1 {
          margin: 0;
          font-size: var(--text-3xl);
          line-height: var(--leading-tight);
          color: var(--text-primary);
        }

        .auth-copy {
          margin: var(--space-2) 0 0;
          color: var(--text-secondary);
          font-size: var(--text-sm);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .auth-error {
          margin: 0;
          color: var(--text-danger);
          font-size: var(--text-sm);
        }
      `}</style>
    </main>
  )
}





