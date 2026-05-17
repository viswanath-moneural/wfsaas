'use client'

import { useEffect, useState } from 'react'
import type { DataBondDefinition } from '@/types/metadata'

interface RelatedListProps {
  bond: DataBondDefinition
  parentRecordId: string
  parentElementKey: string
}

export default function RelatedList({ bond, parentRecordId }: RelatedListProps) {
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch(`/api/elements/${bond.from_element_key}/records?${bond.from_field_key}=${parentRecordId}&limit=5&page=${page}`)
      .then((res) => res.json())
      .then((json) => setRows(json.records ?? []))
      .catch(() => setRows([]))
  }, [bond.from_element_key, bond.from_field_key, parentRecordId, page])

  const columns = rows[0] ? Object.keys(rows[0]).filter((k) => k !== 'id').slice(0, 5) : []

  return (
    <div className="related-list">
      <div className="header">
        <strong>{bond.related_list_label || bond.bond_name}</strong>
      </div>
      <table>
        <thead>
          <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => <td key={col}>{String(row[col] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span>{page}</span>
        <button type="button" onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
      <style jsx>{`
        .related-list { border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: var(--space-3); background: var(--surface-card); }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid var(--border-default); padding: 6px; text-align: left; }
        .pager { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; }
      `}</style>
    </div>
  )
}
