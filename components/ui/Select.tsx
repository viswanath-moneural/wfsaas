'use client'

import { type SelectHTMLAttributes } from 'react'

export default function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <>
      <select className={`shad-select ${className}`.trim()} {...props}>{children}</select>
      <style jsx global>{`
        .shad-select {
          height: 38px;
          min-width: 180px;
          padding: 0 var(--space-3);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          background: var(--surface-card);
          color: var(--text-primary);
          font: inherit;
        }
      `}</style>
    </>
  )
}
