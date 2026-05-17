'use client'

import Card from '@/components/Card'

export default function DataGridRenderer({
  title,
  columns,
  rows,
}: {
  title: string
  columns: Array<{ key: string; label: string }>
  rows: Array<Record<string, any>>
}) {
  return (
    <Card>
      <h2>{title}</h2>
      <table className="grid">
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column.key}>{String(row[column.key] ?? '-')}</td>)}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={columns.length}>No records yet.</td></tr>}
        </tbody>
      </table>
      <style jsx>{`
        h2 {
          margin: 0 0 var(--space-3);
          font-size: var(--text-lg);
        }
        .grid {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: var(--space-2) var(--space-1);
          border-bottom: 1px solid var(--border-default);
          text-align: left;
        }
      `}</style>
    </Card>
  )
}
