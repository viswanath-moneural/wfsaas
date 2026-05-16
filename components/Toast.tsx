'use client'

import { useToast, type Toast, type ToastType } from '@/lib/hooks/useToast'

const ICONS: Record<ToastType, string> = {
  success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>`,
  error:   `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>`,
  warning: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>`,
  info:    `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/></svg>`,
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <div
      className={`toast toast--${toast.type}`}
      role="alert"
      aria-live="polite"
    >
      <span
        className="toast__icon"
        dangerouslySetInnerHTML={{ __html: ICONS[toast.type] }}
        aria-hidden="true"
      />
      <div className="toast__content">
        <p className="toast__title">{toast.title}</p>
        {toast.message && <p className="toast__message">{toast.message}</p>}
      </div>
      <button
        className="toast__close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
        </svg>
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <>
      <style>{TOAST_STYLES}</style>
      <div className="toast-container" aria-label="Notifications">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </>
  )
}

const TOAST_STYLES = `
.toast-container {
  position:       fixed;
  top:            var(--space-4);
  right:          var(--space-4);
  z-index:        var(--z-toast);
  display:        flex;
  flex-direction: column;
  gap:            var(--space-2);
  max-width:      380px;
  width:          calc(100vw - var(--space-8));
}

.toast {
  display:       flex;
  align-items:   flex-start;
  gap:           var(--space-3);
  padding:       var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  border:        1px solid transparent;
  box-shadow:    var(--shadow-lg);
  background:    var(--surface-card);
  animation:     fadeInDown 200ms ease forwards;
}

.toast--success { border-color: var(--color-success-200); }
.toast--error   { border-color: var(--color-danger-200);  }
.toast--warning { border-color: var(--color-warning-200); }
.toast--info    { border-color: var(--color-info-200);    }

.toast__icon {
  flex-shrink: 0;
  width:       20px;
  height:      20px;
  margin-top:  1px;
}
.toast__icon svg { width: 20px; height: 20px; }

.toast--success .toast__icon { color: var(--color-success-600); }
.toast--error   .toast__icon { color: var(--color-danger-600);  }
.toast--warning .toast__icon { color: var(--color-warning-600); }
.toast--info    .toast__icon { color: var(--color-info-600);    }

.toast__content {
  flex:           1;
  min-width:      0;
  display:        flex;
  flex-direction: column;
  gap:            var(--space-0-5);
}

.toast__title {
  font-size:   var(--text-sm);
  font-weight: var(--font-semibold);
  color:       var(--text-primary);
  line-height: var(--leading-snug);
}

.toast__message {
  font-size:   var(--text-xs);
  color:       var(--text-secondary);
  line-height: var(--leading-snug);
}

.toast__close {
  flex-shrink:  0;
  width:        20px;
  height:       20px;
  display:      flex;
  align-items:  center;
  border:       none;
  background:   none;
  color:        var(--text-tertiary);
  cursor:       pointer;
  border-radius:var(--radius-sm);
  padding:      0;
  transition:   color var(--transition-fast), background var(--transition-fast);
}
.toast__close:hover {
  color:      var(--text-primary);
  background: var(--color-gray-100);
}
.toast__close svg { width: 16px; height: 16px; }
`



