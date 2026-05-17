'use client'

import { useRouter } from 'next/navigation'
import Select from '@/components/ui/Select'

export default function LayoutBusinessUnitSelector({
  businessUnits,
  selectedBusinessUnitId,
  basePath,
}: {
  businessUnits: Array<{ id: string; name: string }>
  selectedBusinessUnitId: string
  basePath: string
}) {
  const router = useRouter()
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
      Business Unit
      <Select
        value={selectedBusinessUnitId}
        onChange={(event) => router.push(`${basePath}?businessUnitId=${event.target.value}`)}
      >
        {businessUnits.map((businessUnit) => <option key={businessUnit.id} value={businessUnit.id}>{businessUnit.name}</option>)}
      </Select>
    </label>
  )
}
