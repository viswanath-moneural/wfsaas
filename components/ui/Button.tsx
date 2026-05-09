'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
export type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  loading?:  boolean
  icon?:     ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  icon,
  iconRight,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}, ref) => {
  const isDisabled = disabled || loading

  return (
    <>
      <style>{BUTTON_STYLES}</style>
      <button
        ref={ref}
        className={[
          'btn',
          `btn--${variant}`,
          `btn--${size}`,
          loading   ? 'btn--loading'    : '',
          fullWidth ? 'btn--full-width' : '',
          className,
        ].filter(Boolean).join(' ')}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <span className="btn__spinner" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" />
            </svg>
          </span>
        )}
        {!loading && icon && <span className="btn__icon btn__icon--left">{icon}</span>}
        {children && <span className="btn__label">{children}</span>}
        {iconRight && !loading && <span className="btn__icon btn__icon--right">{iconRight}</span>}
      </button>
    </>
  )
})

Button.displayName = 'Button'
export default Button

const BUTTON_STYLES = `
.btn {
  display:         inline-flex;
  align-items:     center;
  justify-content: center;
  gap:             var(--space-1-5);
  font-family:     var(--font-sans);
  font-weight:     var(--btn-font-weight);
  font-size:       var(--btn-font-size);
  line-height:     1;
  letter-spacing:  var(--tracking-wide);
  border-radius:   var(--btn-radius);
  border:          1px solid transparent;
  cursor:          pointer;
  white-space:     nowrap;
  transition:      background var(--transition-fast),
                   border-color var(--transition-fast),
                   color var(--transition-fast),
                   box-shadow var(--transition-fast),
                   opacity var(--transition-fast);
  text-decoration: none;
  -webkit-user-select: none;
  user-select: none;
}

.btn:focus-visible {
  outline:        2px solid var(--color-primary-600);
  outline-offset: 2px;
}

/* ---- Sizes ---- */
.btn--xs {
  height:  28px;
  padding: 0 var(--space-2);
  font-size: var(--text-xs);
}
.btn--sm {
  height:  var(--btn-height-sm);
  padding: 0 var(--btn-px-sm);
}
.btn--md {
  height:  var(--btn-height-md);
  padding: 0 var(--btn-px-md);
}
.btn--lg {
  height:  var(--btn-height-lg);
  padding: 0 var(--btn-px-lg);
  font-size: var(--text-md);
}

/* ---- Variants ---- */
.btn--primary {
  background:   var(--color-primary-600);
  color:        var(--color-gray-0);
  border-color: var(--color-primary-600);
}
.btn--primary:hover:not(:disabled) {
  background:   var(--color-primary-700);
  border-color: var(--color-primary-700);
}
.btn--primary:active:not(:disabled) {
  background:   var(--color-primary-800);
}

.btn--secondary {
  background:   var(--color-nav-800);
  color:        var(--color-gray-0);
  border-color: var(--color-nav-800);
}
.btn--secondary:hover:not(:disabled) {
  background:   var(--color-nav-700);
  border-color: var(--color-nav-700);
}

.btn--outline {
  background:   transparent;
  color:        var(--text-primary);
  border-color: var(--border-default);
}
.btn--outline:hover:not(:disabled) {
  background:   var(--color-gray-50);
  border-color: var(--border-strong);
}

.btn--ghost {
  background:   transparent;
  color:        var(--text-secondary);
  border-color: transparent;
}
.btn--ghost:hover:not(:disabled) {
  background:   var(--color-gray-100);
  color:        var(--text-primary);
}

.btn--danger {
  background:   var(--color-danger-600);
  color:        var(--color-gray-0);
  border-color: var(--color-danger-600);
}
.btn--danger:hover:not(:disabled) {
  background:   var(--color-danger-700);
  border-color: var(--color-danger-700);
}

.btn--success {
  background:   var(--color-success-600);
  color:        var(--color-gray-0);
  border-color: var(--color-success-600);
}
.btn--success:hover:not(:disabled) {
  background:   var(--color-success-700);
  border-color: var(--color-success-700);
}

/* ---- States ---- */
.btn:disabled,
.btn--loading {
  opacity: 0.55;
  cursor:  not-allowed;
  pointer-events: none;
}

.btn--full-width {
  width: 100%;
}

/* ---- Icons ---- */
.btn__icon {
  display:     flex;
  align-items: center;
  flex-shrink: 0;
}
.btn__icon svg,
.btn__icon > * {
  width:  16px;
  height: 16px;
}
.btn--lg .btn__icon svg,
.btn--lg .btn__icon > * {
  width:  18px;
  height: 18px;
}

/* ---- Spinner ---- */
.btn__spinner {
  display:     flex;
  align-items: center;
  flex-shrink: 0;
}
.btn__spinner svg {
  width:  16px;
  height: 16px;
  animation: spin 0.7s linear infinite;
}
`