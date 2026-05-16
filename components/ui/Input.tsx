'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:       string
  error?:       string
  helper?:      string
  leftIcon?:    ReactNode
  rightIcon?:   ReactNode
  rightAction?: ReactNode   // e.g. a button inside the input
  inputSize?:   'sm' | 'md' | 'lg'
  required?:    boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  rightAction,
  inputSize = 'md',
  required,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <>
      <style>{INPUT_STYLES}</style>
      <div className={`input-field ${error ? 'input-field--error' : ''} ${className}`}>
        {label && (
          <label className="input-field__label" htmlFor={inputId}>
            {label}
            {required && <span className="input-field__required" aria-hidden="true"> *</span>}
          </label>
        )}
        <div className={`input-field__wrapper input-field__wrapper--${inputSize}`}>
          {leftIcon && (
            <span className="input-field__icon input-field__icon--left" aria-hidden="true">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'input-field__input',
              leftIcon    ? 'input-field__input--has-left'  : '',
              rightIcon || rightAction ? 'input-field__input--has-right' : '',
            ].filter(Boolean).join(' ')}
            aria-invalid={!!error}
            aria-describedby={
              error  ? `${inputId}-error`  :
              helper ? `${inputId}-helper` : undefined
            }
            required={required}
            {...props}
          />
          {(rightIcon || rightAction) && (
            <span className="input-field__icon input-field__icon--right">
              {rightIcon ?? rightAction}
            </span>
          )}
        </div>
        {error && (
          <p className="input-field__error" id={`${inputId}-error`} role="alert">
            {error}
          </p>
        )}
        {helper && !error && (
          <p className="input-field__helper" id={`${inputId}-helper`}>
            {helper}
          </p>
        )}
      </div>
    </>
  )
})

Input.displayName = 'Input'
export default Input

const INPUT_STYLES = `
.input-field {
  display:        flex;
  flex-direction: column;
  gap:            var(--space-1-5);
}

.input-field__label {
  font-size:   var(--text-sm);
  font-weight: var(--font-medium);
  color:       var(--text-primary);
  line-height: var(--leading-snug);
}

.input-field__required {
  color: var(--color-danger-500);
  margin-left: 1px;
}

.input-field__wrapper {
  position: relative;
  display:  flex;
  align-items: center;
}

.input-field__wrapper--sm { height: var(--input-height-sm); }
.input-field__wrapper--md { height: var(--input-height-md); }
.input-field__wrapper--lg { height: var(--input-height-lg); }

.input-field__input {
  width:        100%;
  height:       100%;
  padding:      0 var(--input-px);
  font-size:    var(--input-font-size);
  font-family:  var(--font-sans);
  color:        var(--text-primary);
  background:   var(--surface-input);
  border:       1px solid var(--border-default);
  border-radius:var(--input-radius);
  outline:      none;
  transition:   border-color var(--transition-fast),
                box-shadow   var(--transition-fast);
}

.input-field__input::placeholder {
  color: var(--text-tertiary);
}

.input-field__input:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.input-field__input:focus {
  border-color: var(--border-focus);
  box-shadow:   var(--shadow-focus);
}

.input-field__input:disabled {
  background:   var(--surface-disabled);
  color:        var(--text-disabled);
  cursor:       not-allowed;
}

.input-field__input--has-left  { padding-left:  36px; }
.input-field__input--has-right { padding-right: 36px; }

.input-field--error .input-field__input {
  border-color: var(--border-danger);
}
.input-field--error .input-field__input:focus {
  box-shadow: var(--shadow-danger-focus);
}

.input-field__icon {
  position:    absolute;
  display:     flex;
  align-items: center;
  color:       var(--text-tertiary);
  pointer-events: none;
}
.input-field__icon svg,
.input-field__icon > * {
  width:  16px;
  height: 16px;
}
.input-field__icon--left  { left:  10px; }
.input-field__icon--right { right: 10px; pointer-events: auto; }

.input-field__error {
  font-size: var(--text-xs);
  color:     var(--text-danger);
  line-height: var(--leading-snug);
}

.input-field__helper {
  font-size: var(--text-xs);
  color:     var(--text-secondary);
  line-height: var(--leading-snug);
}
`



