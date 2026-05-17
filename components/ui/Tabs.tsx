'use client'

import { createContext, useContext, type ReactNode } from 'react'

const TabsContext = createContext<{ value: string; onValueChange: (value: string) => void } | null>(null)

export function Tabs({ value, onValueChange, children, className = '' }: { value: string; onValueChange: (value: string) => void; children: ReactNode; className?: string }) {
  return <TabsContext.Provider value={{ value, onValueChange }}><div className={className}>{children}</div></TabsContext.Provider>
}

export function TabsList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`shad-tabs-list ${className}`.trim()}>{children}<TabsStyles /></div>
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)
  const active = ctx?.value === value
  return <button type="button" className={active ? 'active' : ''} onClick={() => ctx?.onValueChange(value)}>{children}</button>
}

export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)
  if (ctx?.value !== value) return null
  return <div className="shad-tabs-content">{children}</div>
}

function TabsStyles() {
  return (
    <style jsx global>{`
      .shad-tabs-list {
        display: inline-flex;
        gap: var(--space-1);
        padding: var(--space-1);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: var(--color-gray-50);
      }
      .shad-tabs-list button {
        height: 34px;
        padding: 0 var(--space-3);
        border: 0;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        font-weight: var(--font-medium);
      }
      .shad-tabs-list button.active {
        background: var(--surface-card);
        color: var(--text-primary);
        box-shadow: var(--shadow-sm);
      }
      .shad-tabs-content {
        margin-top: var(--space-4);
      }
    `}</style>
  )
}
