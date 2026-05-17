import Link from 'next/link'
import { getLayoutModules } from '@/app/actions/systemSetup/layouts'
import LayoutBusinessUnitSelector from './LayoutBusinessUnitSelector'

export default async function SystemSetupLayoutsPage({ searchParams }: { searchParams: Promise<{ businessUnitId?: string }> }) {
  const { businessUnitId } = await searchParams
  const result = await getLayoutModules(businessUnitId)

  if (result.error) return <div className="error-panel">{result.error}</div>

  const modules = result.data?.modules ?? []
  const selectedBusinessUnitId = result.data?.selectedBusinessUnitId ?? ''

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Layout Builder</h1>
          <p style={{ margin: 'var(--space-1) 0 var(--space-3)', color: 'var(--text-secondary)' }}>Choose a module to configure its Salesforce-style page layout for the selected Business Unit.</p>
          <LayoutBusinessUnitSelector businessUnits={result.data?.businessUnits ?? []} selectedBusinessUnitId={selectedBusinessUnitId} basePath="/system-setup/layouts" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        {modules.map((module: any) => (
          <Link
            key={module.key}
            href={`/system-setup/layouts/${module.key}?businessUnitId=${selectedBusinessUnitId}`}
            style={{
              display: 'grid',
              gap: 'var(--space-2)',
              minHeight: 150,
              padding: 'var(--space-5)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-card)',
              color: 'var(--text-primary)',
              textDecoration: 'none',
            }}
          >
            <span style={{
              display: 'grid',
              placeItems: 'center',
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary-50)',
              color: 'var(--color-primary-700)',
              fontWeight: 'var(--font-bold)',
            }}>{module.icon}</span>
            <strong style={{ fontSize: 'var(--text-lg)' }}>{module.label}</strong>
            <small style={{ color: 'var(--text-secondary)' }}>{module.layoutCount} layouts</small>
            <small style={{ color: 'var(--text-secondary)' }}>Last modified: {module.lastModified ? new Date(module.lastModified).toLocaleString('en-IN') : 'Never'}</small>
          </Link>
        ))}
      </div>
    </div>
  )
}
