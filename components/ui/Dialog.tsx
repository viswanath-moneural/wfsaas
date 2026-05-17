'use client'

import { type ReactNode } from 'react'
import Button from './Button'

export function Dialog({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null
  return <div className="shad-dialog-root">{children}<DialogStyles /></div>
}

export function DialogContent({ title, description, children, onClose }: { title: string; description?: string; children: ReactNode; onClose: () => void }) {
  return (
    <>
      <button className="shad-dialog-backdrop" onClick={onClose} aria-label="Close dialog" />
      <div className="shad-dialog-content" role="dialog" aria-modal="true" aria-label={title}>
        <div className="shad-dialog-header">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {children}
      </div>
    </>
  )
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="shad-dialog-footer">{children}</div>
}

export function DialogCancel({ onClick }: { onClick: () => void }) {
  return <Button variant="outline" onClick={onClick}>Cancel</Button>
}

function DialogStyles() {
  return (
    <style jsx global>{`
      .shad-dialog-root {
        position: fixed;
        inset: 0;
        z-index: 100;
        display: grid;
        place-items: center;
      }
      .shad-dialog-backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        background: rgba(15, 23, 42, .42);
      }
      .shad-dialog-content {
        position: relative;
        z-index: 1;
        width: min(460px, calc(100vw - 32px));
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--surface-card);
        box-shadow: var(--shadow-xl);
        padding: var(--space-5);
      }
      .shad-dialog-header h2 {
        margin: 0;
        font-size: var(--text-xl);
      }
      .shad-dialog-header p {
        margin: var(--space-2) 0 0;
        color: var(--text-secondary);
      }
      .shad-dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        margin-top: var(--space-5);
      }
    `}</style>
  )
}
