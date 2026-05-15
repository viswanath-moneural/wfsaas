'use client'

import PageHeader from '@/components/layout/PageHeader'
import Card from '@/components/Card'

export default function ConfigurationUsersPage() {
  return (
    <>
      <PageHeader title="Users & Roles" description="User invitation and role assignment is the next configuration increment." />
      <Card>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Minimal route enabled so navigation works during MVP1. User management UI can now be extended safely.
        </p>
      </Card>
    </>
  )
}
