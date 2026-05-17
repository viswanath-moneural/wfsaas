import Link from 'next/link'
import DynamicForm from '@/components/engine/DynamicForm'
import RelatedList from '@/components/engine/RelatedList'
import { createClient } from '@/lib/supabase.server'

export default async function UniversalElementRecordPage({
  params,
}: {
  params: Promise<{ elementKey: string; recordId: string }>
}) {
  const { elementKey, recordId } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return <div className="error-panel">Authentication required.</div>
  const { data: user } = await supabase.from('users').select('org_id, business_unit_id').eq('id', auth.user.id).maybeSingle()
  if (!user?.org_id || !user?.business_unit_id) return <div className="error-panel">No org/business unit context.</div>

  const [{ data: element }, { data: bonds }] = await Promise.all([
    supabase.from('element_definitions').select('element_name, element_name_plural').eq('org_id', user.org_id).eq('business_unit_id', user.business_unit_id).eq('element_key', elementKey).maybeSingle(),
    supabase.from('data_bond_definitions').select('*').eq('org_id', user.org_id).eq('business_unit_id', user.business_unit_id).eq('to_element_key', elementKey),
  ])

  return (
    <main style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <Link href={`/${elementKey}`}>← Back to {element?.element_name_plural ?? elementKey}</Link>
      <h1>{element?.element_name ?? elementKey} · {recordId}</h1>
      <DynamicForm elementKey={elementKey} recordId={recordId} mode="read" />
      <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <h2>Related Lists</h2>
        {(bonds ?? []).map((bond: any) => (
          <RelatedList key={bond.bond_key} bond={bond} parentRecordId={recordId} parentElementKey={elementKey} />
        ))}
      </section>
    </main>
  )
}
