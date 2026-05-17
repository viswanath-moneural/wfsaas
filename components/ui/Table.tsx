'use client'

import { type HTMLAttributes, type TableHTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react'

export function Table({ className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={`shad-table ${className}`.trim()} {...props} />
}

export function TableHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />
}

export function TableRow({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`shad-table-row ${className}`.trim()} {...props} />
}

export function TableHead({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`shad-table-head ${className}`.trim()} {...props} />
}

export function TableCell({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`shad-table-cell ${className}`.trim()} {...props} />
}

export function TableStyles() {
  return (
    <style jsx global>{`
      .shad-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
      }
      .shad-table-head {
        height: 42px;
        padding: 0 var(--space-3);
        border-bottom: 1px solid var(--border-default);
        color: var(--text-tertiary);
        font-weight: var(--font-semibold);
        text-align: left;
        white-space: nowrap;
      }
      .shad-table-cell {
        padding: var(--space-3);
        border-bottom: 1px solid var(--border-subtle);
        color: var(--text-primary);
        vertical-align: middle;
      }
      .shad-table-row:hover .shad-table-cell {
        background: var(--color-gray-50);
      }
    `}</style>
  )
}
