'use client'

import { type SelectHTMLAttributes, useId } from 'react'

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  size?: 'default' | 'compact'
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function Select({
  label,
  error,
  helperText,
  size = 'default',
  className,
  id: idProp,
  children,
  ...props
}: SelectProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const compact = size === 'compact'

  return (
    <div className="flex flex-col">
      {label && (
        <label
          htmlFor={id}
          className="block mb-4 text-label-md font-label font-semibold uppercase tracking-wide text-text-secondary"
        >
          {label}
          {props.required && (
            <span className="ml-1 text-error" aria-hidden="true">*</span>
          )}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          className={cx(
            'w-full appearance-none bg-transparent border-0 border-b-2 outline-none',
            'pl-0',
            compact ? 'pr-5 pb-1.5 text-body-sm' : 'pr-6 pb-2 text-body-md',
            'font-body text-text-primary',
            'transition-colors duration-[var(--transition-duration-fast)]',
            'disabled:text-text-muted disabled:cursor-not-allowed disabled:bg-surface-container',
            error ? 'border-error' : 'border-border focus:border-primary',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cx(
            'absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted',
            compact ? 'w-3 h-3' : 'w-4 h-4',
          )}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-body-sm text-error" role="alert">{error}</p>
      )}
      {!error && helperText && (
        <p className="mt-1.5 text-body-sm text-text-muted">{helperText}</p>
      )}
    </div>
  )
}

export default Select
