'use client'

import type { ReactNode } from 'react'

export type BadgeVariant =
  | 'default' | 'primary' | 'success' | 'warning'
  | 'danger'  | 'info'    | 'purple'  | 'slate'

export type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  variant?:  BadgeVariant
  size?:     BadgeSize
  dot?:      boolean         // Show colored dot before text
  children:  ReactNode
  className?: string
}

export default function Badge({
  variant   = 'default',
  size      = 'md',
  dot       = false,
  children,
  className = '',
}: BadgeProps) {
  return (
    <>
      <style>{BADGE_STYLES}</style>
      <span className={[
        'badge',
        `badge--${variant}`,
        `badge--${size}`,
        className,
      ].filter(Boolean).join(' ')}>
        {dot && <span className="badge__dot" aria-hidden="true" />}
        {children}
      </span>
    </>
  )
}

// ----------------------------------------------------------
// Status → Badge variant mapping
// Use this to keep status colors consistent across the app
// ----------------------------------------------------------
export const STATUS_BADGE: Record<string, BadgeVariant> = {
  // Generic
  active:      'success',
  inactive:    'slate',
  draft:       'default',
  pending:     'warning',
  approved:    'success',
  rejected:    'danger',
  cancelled:   'danger',
  completed:   'success',
  in_progress: 'info',
  on_hold:     'warning',

  // Sales
  confirmed:   'info',
  dispatched:  'primary',
  delivered:   'success',
  invoiced:    'primary',
  paid:        'success',
  overdue:     'danger',
  partial:     'warning',

  // Manufacturing
  planned:     'default',
  running:     'info',
  paused:      'warning',
  finished:    'success',

  // Leads
  new:         'info',
  contacted:   'primary',
  qualified:   'success',
  lost:        'danger',
  converted:   'success',

  // Machines
  operational: 'success',
  maintenance: 'warning',
  breakdown:   'danger',

  // Tickets
  open:        'warning',
  resolved:    'success',
  closed:      'slate',
}

const BADGE_STYLES = `
.badge {
  display:       inline-flex;
  align-items:   center;
  gap:           var(--space-1);
  font-family:   var(--font-sans);
  font-weight:   var(--font-medium);
  border-radius: var(--radius-full);
  white-space:   nowrap;
  line-height:   1;
}

/* ---- Sizes ---- */
.badge--sm {
  font-size: 10px;
  padding:   2px 6px;
  letter-spacing: 0.03em;
}
.badge--md {
  font-size: var(--text-xs);
  padding:   3px 8px;
  letter-spacing: 0.02em;
}

/* ---- Dot ---- */
.badge__dot {
  width:         6px;
  height:        6px;
  border-radius: var(--radius-full);
  background:    currentColor;
  flex-shrink:   0;
}

/* ---- Variants ---- */
.badge--default {
  background: var(--color-gray-100);
  color:      var(--color-gray-600);
}
.badge--primary {
  background: var(--color-primary-100);
  color:      var(--color-primary-700);
}
.badge--success {
  background: var(--color-success-100);
  color:      var(--color-success-700);
}
.badge--warning {
  background: var(--color-warning-100);
  color:      var(--color-warning-700);
}
.badge--danger {
  background: var(--color-danger-100);
  color:      var(--color-danger-700);
}
.badge--info {
  background: var(--color-info-100);
  color:      var(--color-info-700);
}
.badge--purple {
  background: var(--color-purple-100);
  color:      var(--color-purple-700);
}
.badge--slate {
  background: var(--color-nav-100);
  color:      var(--color-nav-600);
}
`



