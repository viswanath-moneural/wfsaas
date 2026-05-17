import ElementDynamicFormClient from './ElementDynamicFormClient'
import { createClient } from '@/lib/supabase.server'
import { ensureDefaultScreenDesign } from '@/lib/engine/screen-design'

export default async function ElementDynamicForm({
  elementKey,
  defaultValues = {},
  operation = 'insert',
}: {
  elementKey: string
  defaultValues?: Record<string, any>
  operation?: 'insert' | 'update'
}) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return <div className="error-panel">Authentication required.</div>

  const { data: user } = await supabase
    .from('users')
    .select('id, org_id, business_unit_id')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (!user?.org_id || !user?.business_unit_id) return <div className="error-panel">Missing org or business unit scope.</div>

  await ensureDefaultScreenDesign({
    orgId: user.org_id,
    businessUnitId: user.business_unit_id,
    elementKey,
    userId: user.id,
  })

  return (
    <ElementDynamicFormClient
      elementKey={elementKey}
      defaultValues={defaultValues}
      operation={operation}
    />
  )
}
