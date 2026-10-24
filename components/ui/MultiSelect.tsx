'use client'

import { useRef, useEffect, useState, useId } from 'react'

export interface MultiSelectProps {
  options: { label: string; value: string }[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  label?: string
  error?: string
  helperText?: string
  disabled?: boolean
  className?: string
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cx(
        'w-4 h-4 flex-shrink-0 pointer-events-none text-text-muted transition-transform duration-[var(--transition-duration-base)]',
        open && 'rotate-180',
      )}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  error,
  helperText,
  disabled = false,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const autoId = useId()

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function toggleValue(v: string) {
    if (value.includes(v)) {
      onChange(value.filter(x => x !== v))
    } else {
      onChange([...value, v])
    }
  }

  const triggerText =
    value.length === 0
      ? null
      : value.length === 1
      ? (options.find(o => o.value === value[0])?.label ?? value[0])
      : `${value.length} selected`

  return (
    <div className="flex flex-col">
      {label && (
        <label
          htmlFor={autoId}
          className="block mb-4 text-label-md font-label font-semibold uppercase tracking-wide text-text-secondary"
        >
          {label}
        </label>
      )}

      <div ref={ref} className={cx('relative', className)}>
        <button
          id={autoId}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => { if (!disabled) setOpen(o => !o) }}
          className={cx(
            'w-full flex items-center justify-between border-0 border-b-2 bg-transparent outline-none pb-2',
            'text-body-md font-body transition-colors duration-[var(--transition-duration-fast)]',
            disabled && 'text-text-muted cursor-not-allowed',
            !disabled && (error ? 'border-error' : open ? 'border-primary' : 'border-border hover:border-primary'),
          )}
        >
          <span className={cx(triggerText ? 'text-text-primary' : 'text-text-muted')}>
            {triggerText ?? placeholder}
          </span>
          <ChevronIcon open={open} />
        </button>

        {open && (
          <div
            role="listbox"
            aria-multiselectable="true"
            className="absolute top-full mt-2 min-w-full w-max max-w-xs max-h-48 overflow-y-auto bg-surface-card rounded-md shadow-3 z-[var(--z-popover)]"
          >
            {options.map(option => {
              const checked = value.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-container-low"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(option.value)}
                    className="flex-shrink-0"
                  />
                  <span className="text-body-sm text-text-primary">{option.label}</span>
                </label>
              )
            })}
          </div>
        )}
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

export default MultiSelect
