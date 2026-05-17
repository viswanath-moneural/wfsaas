'use client'

import { type ButtonHTMLAttributes } from 'react'

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
}

export default function Switch({ checked, onCheckedChange, className = '', disabled, ...props }: SwitchProps) {
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`shad-switch ${checked ? 'shad-switch--checked' : ''} ${className}`.trim()}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange?.(!checked)}
        {...props}
      >
        <span />
      </button>
      <style jsx global>{`
        .shad-switch {
          position: relative;
          width: 40px;
          height: 22px;
          border: 1px solid var(--border-strong);
          border-radius: 999px;
          background: var(--color-gray-200);
          cursor: pointer;
          transition: background var(--transition-fast), border-color var(--transition-fast);
        }
        .shad-switch span {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: var(--surface-card);
          box-shadow: var(--shadow-sm);
          transition: transform var(--transition-fast);
        }
        .shad-switch--checked {
          border-color: var(--color-success-600);
          background: var(--color-success-600);
        }
        .shad-switch--checked span {
          transform: translateX(18px);
        }
        .shad-switch:disabled {
          cursor: not-allowed;
          opacity: .55;
        }
      `}</style>
    </>
  )
}
