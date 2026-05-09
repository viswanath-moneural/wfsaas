'use client'

import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?:  'none' | 'sm' | 'md' | 'lg'
  border?:   boolean
  shadow?:   'none' | 'sm' | 'md'
  children:  ReactNode
}

export default function Card({
  padding  = 'md',
  border   = true,
  shadow   = 'sm',
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <>
      <style>{CARD_STYLES}</style>
      <div
        className={[
          'card',
          `card--p-${padding}`,
          border ? 'card--border' : '',
          shadow !== 'none' ? `card--shadow-${shadow}` : '',
          className,
        ].filter(Boolean).join(' ')}
        {...props}
      >
        {children}
      </div>
    </>
  )
}

interface CardHeaderProps {
  title:      string
  subtitle?:  string
  action?:    ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`card-header ${className}`}>
      <div className="card-header__text">
        <h3 className="card-header__title">{title}</h3>
        {subtitle && <p className="card-header__subtitle">{subtitle}</p>}
      </div>
      {action && <div className="card-header__action">{action}</div>}
    </div>
  )
}

interface CardDividerProps { className?: string }
export function CardDivider({ className = '' }: CardDividerProps) {
  return <hr className={`card-divider ${className}`} />
}

const CARD_STYLES = `
.card {
  background:    var(--surface-card);
  border-radius: var(--radius-lg);
  position:      relative;
}

/* Padding */
.card--p-none { padding: 0; }
.card--p-sm   { padding: var(--space-4); }
.card--p-md   { padding: var(--space-6); }
.card--p-lg   { padding: var(--space-8); }

/* Border */
.card--border {
  border: 1px solid var(--border-default);
}

/* Shadow */
.card--shadow-sm { box-shadow: var(--shadow-sm); }
.card--shadow-md { box-shadow: var(--shadow-md); }

/* Card header */
.card-header {
  display:         flex;
  align-items:     flex-start;
  justify-content: space-between;
  gap:             var(--space-4);
  margin-bottom:   var(--space-5);
}

.card-header__text {
  display:        flex;
  flex-direction: column;
  gap:            var(--space-0-5);
}

.card-header__title {
  font-size:   var(--text-lg);
  font-weight: var(--font-semibold);
  color:       var(--text-primary);
}

.card-header__subtitle {
  font-size:   var(--text-sm);
  color:       var(--text-secondary);
  line-height: var(--leading-snug);
}

.card-header__action {
  flex-shrink: 0;
}

/* Divider */
.card-divider {
  border:        none;
  border-top:    1px solid var(--border-default);
  margin:        var(--space-5) calc(-1 * var(--space-6));
}
`