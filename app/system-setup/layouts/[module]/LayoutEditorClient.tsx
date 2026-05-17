'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import LayoutBusinessUnitSelector from '../LayoutBusinessUnitSelector'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Switch from '@/components/ui/Switch'
import { savePageLayout, type LayoutField, type LayoutSection } from '@/app/actions/systemSetup/layouts'

type SelectedField = { sectionId: string; fieldId: string } | null

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeSections(sections: LayoutSection[]) {
  return sections.map((section) => ({
    ...section,
    fields: section.fields.map((field, index) => ({
      ...field,
      row: Math.floor(index / section.columns) + 1,
      column: (index % section.columns) + 1,
    })),
  }))
}

function findField(sections: LayoutSection[], selected: SelectedField) {
  if (!selected) return null
  return sections.find((section) => section.id === selected.sectionId)?.fields.find((field) => field.id === selected.fieldId) ?? null
}

function createField(id: string): LayoutField {
  return {
    id,
    label: humanize(id),
    required: false,
    visible: true,
    readOnly: false,
    helpText: '',
    column: 1,
    row: 1,
    visibility: null,
  }
}

function SortableSection({ section, children }: { section: LayoutSection; children: React.ReactNode }) {
  const sortable = useSortable({ id: `section:${section.id}` })
  return (
    <section
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className="layout-section"
    >
      <button className="drag-handle" {...sortable.attributes} {...sortable.listeners} aria-label={`Drag ${section.title}`}>Grip</button>
      {children}
    </section>
  )
}

function DroppableArea({ id, children, className = '' }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <div ref={setNodeRef} className={`${className} ${isOver ? 'is-over' : ''}`.trim()}>{children}</div>
}

function SortableField({ sectionId, field, onClick }: { sectionId: string; field: LayoutField; onClick: () => void }) {
  const sortable = useSortable({ id: `field:${sectionId}:${field.id}` })
  return (
    <button
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className="layout-field"
      type="button"
      onClick={onClick}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <strong>{field.label}</strong>
      <span>{field.required ? 'Required' : 'Optional'}{field.readOnly ? ' · Read-only' : ''}</span>
    </button>
  )
}

export default function LayoutEditorClient({ data }: { data: any }) {
  const scopedStorageKey = `layout_draft_${data.selectedBusinessUnitId}_${data.module.key}`
  const [layoutId, setLayoutId] = useState<string | null>(data.layout.id)
  const [layoutName, setLayoutName] = useState(data.layout.layout_name ?? 'Default Layout')
  const [isDefault, setIsDefault] = useState(Boolean(data.layout.is_default))
  const [sections, setSections] = useState<LayoutSection[]>(() => normalizeSections(data.layout.sections ?? []))
  const [savedSections, setSavedSections] = useState<LayoutSection[]>(() => normalizeSections(data.layout.sections ?? []))
  const [selectedField, setSelectedField] = useState<SelectedField>(null)
  const [preview, setPreview] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    const draft = window.localStorage.getItem(scopedStorageKey)
    if (!draft) return
    try {
      const parsed = JSON.parse(draft)
      if (Array.isArray(parsed.sections)) {
        setSections(normalizeSections(parsed.sections))
        setLayoutName(parsed.layoutName ?? layoutName)
        setIsDefault(Boolean(parsed.isDefault))
        setMessage('Recovered an autosaved draft.')
      }
    } catch {
      window.localStorage.removeItem(scopedStorageKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedStorageKey])

  useEffect(() => {
    const interval = window.setInterval(() => {
      window.localStorage.setItem(scopedStorageKey, JSON.stringify({ layoutName, isDefault, sections }))
    }, 30000)
    return () => window.clearInterval(interval)
  }, [isDefault, layoutName, scopedStorageKey, sections])

  const usedFieldIds = useMemo(() => new Set(sections.flatMap((section) => section.fields.map((field) => field.id))), [sections])
  const availableFields = data.fields.filter((field: any) => !usedFieldIds.has(field.id))
  const isDirty = JSON.stringify(sections) !== JSON.stringify(savedSections)
  const selected = findField(sections, selectedField)

  function updateSections(next: LayoutSection[]) {
    setSections(normalizeSections(next))
  }

  function addSection() {
    updateSections([...sections, { id: `section_${Date.now()}`, title: 'New Section', columns: 2, fields: [] }])
  }

  function updateSection(sectionId: string, patch: Partial<LayoutSection>) {
    updateSections(sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section))
  }

  function deleteSection(sectionId: string) {
    if (!window.confirm('Delete this section? Its fields will return to Available Fields.')) return
    updateSections(sections.filter((section) => section.id !== sectionId))
    if (selectedField?.sectionId === sectionId) setSelectedField(null)
  }

  function updateField(patch: Partial<LayoutField>) {
    if (!selectedField) return
    updateSections(sections.map((section) => section.id === selectedField.sectionId
      ? { ...section, fields: section.fields.map((field) => field.id === selectedField.fieldId ? { ...field, ...patch } : field) }
      : section
    ))
  }

  function parseDragId(id: string) {
    const parts = id.split(':')
    return { type: parts[0], sectionId: parts[1], fieldId: parts[2] }
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : ''
    if (!overId || activeId === overId) return

    const active = parseDragId(activeId)
    const over = parseDragId(overId)

    if (active.type === 'section' && over.type === 'section') {
      const oldIndex = sections.findIndex((section) => section.id === active.sectionId)
      const newIndex = sections.findIndex((section) => section.id === over.sectionId)
      if (oldIndex >= 0 && newIndex >= 0) updateSections(arrayMove(sections, oldIndex, newIndex))
      return
    }

    if (active.type === 'available') {
      const targetSectionId = over.type === 'section-drop' ? over.sectionId : over.type === 'field' ? over.sectionId : ''
      if (!targetSectionId || usedFieldIds.has(active.sectionId)) return
      updateSections(sections.map((section) => section.id === targetSectionId ? { ...section, fields: [...section.fields, createField(active.sectionId)] } : section))
      return
    }

    if (active.type === 'field' && over.type === 'available-drop') {
      updateSections(sections.map((section) => section.id === active.sectionId ? { ...section, fields: section.fields.filter((field) => field.id !== active.fieldId) } : section))
      if (selectedField?.fieldId === active.fieldId) setSelectedField(null)
      return
    }

    if (active.type === 'field') {
      const targetSectionId = over.type === 'section-drop' ? over.sectionId : over.type === 'field' ? over.sectionId : active.sectionId
      const sourceSection = sections.find((section) => section.id === active.sectionId)
      const targetSection = sections.find((section) => section.id === targetSectionId)
      const moving = sourceSection?.fields.find((field) => field.id === active.fieldId)
      if (!sourceSection || !targetSection || !moving) return

      let next = sections.map((section) => section.id === active.sectionId ? { ...section, fields: section.fields.filter((field) => field.id !== active.fieldId) } : section)
      const targetIndex = over.type === 'field'
        ? targetSection.fields.findIndex((field) => field.id === over.fieldId)
        : targetSection.fields.length
      next = next.map((section) => {
        if (section.id !== targetSectionId) return section
        const fields = section.id === active.sectionId ? section.fields.filter((field) => field.id !== active.fieldId) : [...section.fields]
        fields.splice(targetIndex < 0 ? fields.length : targetIndex, 0, moving)
        return { ...section, fields }
      })
      updateSections(next)
    }
  }

  function save() {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await savePageLayout({
        id: layoutId,
        business_unit_id: data.selectedBusinessUnitId,
        module_key: data.module.key,
        layout_name: layoutName,
        is_default: isDefault,
        sections,
      })
      if (result.error || !result.data) {
        setError(result.error ?? 'Save failed.')
        return
      }
      setLayoutId(result.data.id)
      setSavedSections(sections)
      window.localStorage.removeItem(scopedStorageKey)
      setMessage('Layout saved.')
    })
  }

  return (
    <div className="layout-editor">
      <div className="editor-header">
        <div>
          <Link href={`/system-setup/layouts?businessUnitId=${data.selectedBusinessUnitId}`}>Back to layouts</Link>
          <h1>{data.module.label} Layout Builder</h1>
          <p>{isDirty ? 'Unsaved changes' : 'All changes saved'} · Autosaves locally every 30 seconds</p>
        </div>
        <div className="header-actions">
          <LayoutBusinessUnitSelector businessUnits={data.businessUnits} selectedBusinessUnitId={data.selectedBusinessUnitId} basePath={`/system-setup/layouts/${data.module.key}`} />
          <label><Switch checked={isDefault} onCheckedChange={setIsDefault} /> Set as Default</label>
          <Button variant="outline" onClick={() => setPreview((current) => !current)}>{preview ? 'Edit Mode' : 'Preview'}</Button>
          <Button loading={isPending} onClick={save}>Save Layout</Button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <Input label="Layout Name" value={layoutName} onChange={(event) => setLayoutName(event.target.value)} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className={preview ? 'editor-grid preview-mode' : 'editor-grid'}>
          {!preview && (
            <DroppableArea id="available-drop" className="available-panel">
              <h2>Available Fields</h2>
              {availableFields.map((field: any) => (
                <AvailableField key={field.id} field={field} />
              ))}
              {!availableFields.length && <p>All fields are on the layout.</p>}
            </DroppableArea>
          )}

          <div className="layout-canvas">
            {!preview && <Button variant="outline" onClick={addSection}>Add New Section</Button>}
            <SortableContext items={sections.map((section) => `section:${section.id}`)} strategy={verticalListSortingStrategy}>
              {sections.map((section) => (
                <SortableSection key={section.id} section={section}>
                  <div className="section-header">
                    {preview ? <h2>{section.title}</h2> : <Input label="Section title" value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} />}
                    {!preview && (
                      <div className="section-actions">
                        <Button size="xs" variant="outline" onClick={() => updateSection(section.id, { columns: section.columns === 1 ? 2 : 1 })}>{section.columns} Column</Button>
                        <Button size="xs" variant="danger" onClick={() => deleteSection(section.id)}>Delete</Button>
                      </div>
                    )}
                  </div>
                  <DroppableArea id={`section-drop:${section.id}`} className={`section-fields columns-${section.columns}`}>
                    <SortableContext items={section.fields.map((field) => `field:${section.id}:${field.id}`)} strategy={verticalListSortingStrategy}>
                      {section.fields.map((field) => preview ? (
                        <div key={field.id} className="preview-field">
                          <label>{field.label}{field.required ? ' *' : ''}</label>
                          <input disabled placeholder={field.helpText || field.label} />
                        </div>
                      ) : (
                        <SortableField key={field.id} sectionId={section.id} field={field} onClick={() => setSelectedField({ sectionId: section.id, fieldId: field.id })} />
                      ))}
                    </SortableContext>
                    {!section.fields.length && !preview && <p className="drop-hint">Drop fields here.</p>}
                  </DroppableArea>
                </SortableSection>
              ))}
            </SortableContext>
          </div>

          {!preview && (
            <aside className="properties-panel">
              <h2>Field Properties</h2>
              {selected ? (
                <div className="properties-form">
                  <Input label="Label" value={selected.label} onChange={(event) => updateField({ label: event.target.value })} />
                  <label><Switch checked={selected.required} onCheckedChange={(checked) => updateField({ required: checked })} /> Required</label>
                  <label><Switch checked={Boolean(selected.readOnly)} onCheckedChange={(checked) => updateField({ readOnly: checked })} /> Read-only</label>
                  <label><Switch checked={selected.visible} onCheckedChange={(checked) => updateField({ visible: checked })} /> Visible</label>
                  <label>Help Text<textarea value={selected.helpText ?? ''} onChange={(event) => updateField({ helpText: event.target.value })} /></label>
                  <label>Visibility Condition Field<input value={selected.visibility?.field ?? ''} onChange={(event) => updateField({ visibility: { field: event.target.value, value: selected.visibility?.value ?? '' } })} placeholder="another_field" /></label>
                  <label>Visibility Condition Value<input value={selected.visibility?.value ?? ''} onChange={(event) => updateField({ visibility: { field: selected.visibility?.field ?? '', value: event.target.value } })} placeholder="value" /></label>
                </div>
              ) : <p>Select a field on the canvas to edit its properties.</p>}
            </aside>
          )}
        </div>
      </DndContext>

      <style jsx>{`
        .editor-header {
          display: flex;
          justify-content: space-between;
          gap: var(--space-4);
          margin-bottom: var(--space-5);
        }
        .editor-header a {
          color: var(--color-primary-700);
          font-size: var(--text-sm);
          text-decoration: none;
        }
        h1 {
          margin: var(--space-2) 0 0;
          font-size: var(--text-2xl);
        }
        p {
          margin: var(--space-1) 0 0;
          color: var(--text-secondary);
        }
        .header-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--space-3);
        }
        .header-actions label,
        .properties-form label {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .editor-grid {
          display: grid;
          grid-template-columns: 240px minmax(0, 1fr) 280px;
          gap: var(--space-4);
          margin-top: var(--space-5);
        }
        .preview-mode {
          grid-template-columns: minmax(0, 1fr);
        }
        .available-panel,
        .properties-panel,
        .layout-section {
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background: var(--surface-card);
        }
        .available-panel,
        .properties-panel {
          align-self: start;
          padding: var(--space-4);
        }
        .available-panel h2,
        .properties-panel h2,
        .layout-section h2 {
          margin: 0 0 var(--space-3);
          font-size: var(--text-md);
        }
        .available-field,
        .layout-field {
          width: 100%;
          display: grid;
          gap: var(--space-1);
          margin-bottom: var(--space-2);
          padding: var(--space-3);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--surface-card);
          color: var(--text-primary);
          text-align: left;
          cursor: grab;
        }
        .layout-field span,
        .available-field span {
          color: var(--text-secondary);
          font-size: var(--text-xs);
        }
        .layout-canvas {
          display: grid;
          gap: var(--space-4);
        }
        .layout-section {
          position: relative;
          padding: var(--space-4);
        }
        .drag-handle {
          position: absolute;
          top: var(--space-3);
          right: var(--space-3);
          border: 0;
          background: transparent;
          color: var(--text-tertiary);
          cursor: grab;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
        }
        .section-actions {
          display: flex;
          gap: var(--space-2);
          align-items: end;
        }
        .section-fields {
          display: grid;
          gap: var(--space-3);
          min-height: 72px;
          padding: var(--space-3);
          border: 1px dashed var(--border-default);
          border-radius: var(--radius-md);
        }
        .columns-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .is-over {
          outline: 2px solid var(--color-primary-300);
          outline-offset: 2px;
        }
        .drop-hint {
          margin: 0;
          color: var(--text-tertiary);
        }
        .properties-form {
          display: grid;
          gap: var(--space-3);
        }
        textarea,
        .properties-form input {
          width: 100%;
          padding: var(--space-2);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          font: inherit;
        }
        .preview-field {
          display: grid;
          gap: var(--space-1);
        }
        .preview-field label {
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
        }
        .preview-field input {
          height: 38px;
          padding: 0 var(--space-3);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
        }
        @media (max-width: 1100px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function AvailableField({ field }: { field: { id: string; label: string } }) {
  const sortable = useSortable({ id: `available:${field.id}` })
  return (
    <button
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className="available-field"
      type="button"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <strong>{field.label}</strong>
      <span>{field.id}</span>
    </button>
  )
}
