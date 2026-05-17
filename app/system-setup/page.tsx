'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { bootstrapSystemSetup, getSystemSetupState } from '@/app/actions/systemSetup'

const EMPTY_FORM = {
  organisationName: 'WFSAAS Platform',
  organisationSlug: 'wfsaas-platform',
  country: 'India',
  timezone: 'Asia/Kolkata',
  businessUnitName: '',
  businessUnitPhone: '',
  businessUnitAddress: '',
}

export default function SystemSetupPage() {
  const router = useRouter()
  const [state, setState] = useState<any>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void getSystemSetupState().then((result) => {
      setState(result)
      setLoading(false)
      if (result.ok && result.hasOrg && result.hasBusinessUnit) router.replace('/dashboard')
    })
  }, [router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const result = await bootstrapSystemSetup(form)
    setSaving(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`active_business_unit_${result.orgId}`, result.businessUnitId)
    }
    router.replace('/dashboard')
    router.refresh()
  }

  if (loading) {
    return <main className="system-setup"><Card><p>Loading system setup...</p></Card><SystemSetupStyles /></main>
  }

  if (!state?.ok) {
    return <main className="system-setup"><Card><h1>System Setup unavailable</h1><p>{state?.message ?? 'Sign in before system setup.'}</p></Card><SystemSetupStyles /></main>
  }

  if (!state.isSuperadmin) {
    return (
      <main className="system-setup">
        <Card>
          <h1>Contact your administrator</h1>
          <p>Your login is not mapped to an organisation or business unit yet. Ask your administrator to assign access from Configuration.</p>
        </Card>
        <SystemSetupStyles />
      </main>
    )
  }

  return (
    <main className="system-setup">
      <Card>
        <h1>Initial System Setup</h1>
        <p>Create the first organisation and business unit, then this login will be assigned automatically.</p>
        <form onSubmit={handleSubmit}>
          <Input label="Organisation name" value={form.organisationName} onChange={(event) => setForm((prev) => ({ ...prev, organisationName: event.target.value }))} required />
          <Input label="Slug" value={form.organisationSlug} onChange={(event) => setForm((prev) => ({ ...prev, organisationSlug: event.target.value }))} required />
          <Input label="Country" value={form.country} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))} />
          <Input label="Timezone" value={form.timezone} onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))} />
          <Input label="Business Unit name" value={form.businessUnitName} onChange={(event) => setForm((prev) => ({ ...prev, businessUnitName: event.target.value }))} required />
          <Input label="Business Unit phone" value={form.businessUnitPhone} onChange={(event) => setForm((prev) => ({ ...prev, businessUnitPhone: event.target.value }))} />
          <Input label="Business Unit address" value={form.businessUnitAddress} onChange={(event) => setForm((prev) => ({ ...prev, businessUnitAddress: event.target.value }))} />
          {error && <p className="form-error">{error}</p>}
          <Button type="submit" loading={saving} fullWidth>Complete System Setup</Button>
        </form>
      </Card>
      <SystemSetupStyles />
    </main>
  )
}

function SystemSetupStyles() {
  return (
    <style jsx global>{`
      .system-setup {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: var(--space-6);
        background: var(--surface-page);
      }

      .system-setup :global(.card) {
        width: min(520px, 100%);
      }

      .system-setup h1 {
        margin: 0;
        font-size: var(--text-2xl);
      }

      .system-setup p {
        margin: var(--space-2) 0 var(--space-5);
        color: var(--text-secondary);
      }

      .system-setup form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .system-setup .form-error {
        margin: 0;
        color: var(--text-danger);
        font-size: var(--text-sm);
      }
    `}</style>
  )
}










