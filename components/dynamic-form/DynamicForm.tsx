import DynamicFormClient from './DynamicFormClient'
import { getDefaultLayout } from '@/app/actions/systemSetup/layouts'
import { MODULE_FIELDS } from '@/lib/layoutBuilder'

export default async function DynamicForm({
  moduleKey,
  businessUnitId,
  defaultValues = {},
  readOnly = false,
}: {
  moduleKey: string
  businessUnitId?: string
  defaultValues?: Record<string, unknown>
  readOnly?: boolean
}) {
  const result = await getDefaultLayout(moduleKey, businessUnitId)
  const fallbackFields = MODULE_FIELDS[moduleKey] ?? []
  const fallbackLayout = {
    sections: [{
      id: 'section_1',
      title: 'Information',
      columns: 2,
      fields: fallbackFields.map((field, index) => ({
        id: field,
        label: field.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        required: false,
        visible: true,
        readOnly: false,
        helpText: '',
        column: (index % 2) + 1,
        row: Math.floor(index / 2) + 1,
      })),
    }],
  }

  return (
    <DynamicFormClient
      moduleKey={moduleKey}
      sections={(result.data?.sections as any) ?? fallbackLayout.sections}
      defaultValues={defaultValues}
      readOnly={readOnly}
    />
  )
}
