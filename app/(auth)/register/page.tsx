'use client'

import Link from 'next/link'

export default function RegisterPage() {
  return (
    <main className="auth-info-page">
      <section>
        <p>WFSAAS</p>
        <h1>Registration is invite based</h1>
        <span>Ask your organisation admin to invite you, then use the invite link to activate your account.</span>
        <Link href="/login">Back to sign in</Link>
      </section>

      <style jsx>{`
        .auth-info-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: var(--space-6);
          background: var(--surface-page);
        }

        section {
          width: min(100%, 460px);
          padding: var(--space-8);
          background: var(--surface-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        p {
          margin: 0 0 var(--space-2);
          color: var(--color-primary-600);
          font-size: var(--text-xs);
          font-weight: var(--font-bold);
          letter-spacing: var(--tracking-widest);
        }

        h1 {
          margin: 0;
          color: var(--text-primary);
          font-size: var(--text-3xl);
          line-height: var(--leading-tight);
        }

        span {
          display: block;
          margin: var(--space-3) 0 var(--space-5);
          color: var(--text-secondary);
          font-size: var(--text-sm);
          line-height: var(--leading-normal);
        }

        a {
          color: var(--text-link);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }
      `}</style>
    </main>
  )
}
