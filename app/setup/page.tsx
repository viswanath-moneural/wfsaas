'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { bootstrapOrganisationAndFactory, getSetupState } from '@/app/actions/setup'

const EMPTY_FORM = {
  organisationName: 'WFSAAS Platform',
  organisationSlug: 'wfsaas-platform',
  country: 'India',
  timezone: 'Asia/Kolkata',
  factoryName: '',
  factoryPhone: '',
  factoryAddress: '',
}

export default function SetupPage() {
  const router = useRouter()
  const [state, setState] = useState<any>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void getSetupState().then((result) => {
      setState(result)
      setLoading(false)
      if (result.ok && result.hasOrg && result.hasFactory) router.replace('/dashboard')
    })
  }, [router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const result = await bootstrapOrganisationAndFactory(form)
    setSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`active_tenant_${result.orgId}`, result.factoryId)
    }
    router.replace('/dashboard')
    router.refresh()
  }

  if (loading) {
    return <main className="setup"><Card><p>Loading setup...</p></Card><SetupStyles /></main>
  }

  if (!state?.ok) {
    return <main className="setup"><Card><h1>Setup unavailable</h1><p>{state?.message ?? 'Sign in before setup.'}</p></Card><SetupStyles /></main>
  }

  if (!state.isSuperadmin) {
    return (
      <main className="setup">
        <Card>
          <h1>Contact your administrator</h1>
          <p>Your login is not mapped to an organisation or factory yet. Ask your administrator to assign access from Configuration.</p>
        </Card>
        <SetupStyles />
      </main>
    )
  }

  return (
    <main className="setup">
      <Card>
        <h1>Initial setup</h1>
        <p>Create the first organisation and factory, then this login will be assigned automatically.</p>
        <form onSubmit={handleSubmit}>
          <Input label="Organisation name" value={form.organisationName} onChange={(event) => setForm((prev) => ({ ...prev, organisationName: event.target.value }))} required />
          <Input label="Slug" value={form.organisationSlug} onChange={(event) => setForm((prev) => ({ ...prev, organisationSlug: event.target.value }))} required />
          <Input label="Country" value={form.country} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))} />
          <Input label="Timezone" value={form.timezone} onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))} />
          <Input label="Factory name" value={form.factoryName} onChange={(event) => setForm((prev) => ({ ...prev, factoryName: event.target.value }))} required />
          <Input label="Factory phone" value={form.factoryPhone} onChange={(event) => setForm((prev) => ({ ...prev, factoryPhone: event.target.value }))} />
          <Input label="Factory address" value={form.factoryAddress} onChange={(event) => setForm((prev) => ({ ...prev, factoryAddress: event.target.value }))} />
          {error && <p className="form-error">{error}</p>}
          <Button type="submit" loading={saving} fullWidth>Complete setup</Button>
        </form>
      </Card>
      <SetupStyles />
    </main>
  )
}

function SetupStyles() {
  return (
    <style jsx global>{`
      .setup {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: var(--space-6);
        background: var(--surface-page);
      }

      .setup :global(.card) {
        width: min(520px, 100%);
      }

      .setup h1 {
        margin: 0;
        font-size: var(--text-2xl);
      }

      .setup p {
        margin: var(--space-2) 0 var(--space-5);
        color: var(--text-secondary);
      }

      .setup form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .setup .form-error {
        margin: 0;
        color: var(--text-danger);
        font-size: var(--text-sm);
      }
    `}</style>
  )
}
