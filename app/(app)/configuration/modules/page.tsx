'use client'

import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/Card'

export default function ConfigurationModulesPage() {
  return (
    <>
      <PageHeader title="Modules" description="Module toggles are enabled at organisation level." />
      <Card>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Minimal route enabled so configuration navigation remains complete during MVP1 stabilization.
        </p>
      </Card>
    </>
  )
}
