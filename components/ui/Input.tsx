'use client'

import { type InputHTMLAttributes, useId } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function Input({
  label,
  error,
  helperText,
  className,
  id: idProp,
  ...props
}: InputProps) {
  const autoId = useId()
  const id = idProp ?? autoId

  return (
    <div className="flex flex-col">
      {label && (
        <label
          htmlFor={id}
          className="block mb-1.5 text-label-md font-label font-semibold uppercase tracking-wide text-text-muted"
        >
          {label}
          {props.required && (
            <span className="ml-1 text-error" aria-hidden="true">*</span>
          )}
        </label>
      )}
      <input
        id={id}
        className={cx(
          'w-full bg-transparent border-0 border-b-2 outline-none',
          'px-0 py-2',
          'text-body-md font-body text-text-primary',
          'placeholder:text-text-muted',
          'transition-colors duration-[var(--transition-duration-fast)]',
          'disabled:text-text-muted disabled:cursor-not-allowed disabled:opacity-60',
          'read-only:text-text-muted read-only:cursor-default',
          error ? 'border-error' : 'border-border focus:border-primary',
          className,
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-body-sm text-error" role="alert">{error}</p>
      )}
      {!error && helperText && (
        <p className="mt-1.5 text-body-sm text-text-muted">{helperText}</p>
      )}
    </div>
  )
}

export default Input
