'use client'

import { type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'toggle' | 'pill' | 'icon' | 'text'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner and blocks interaction */
  loading?: boolean
  /** Stretches the button to fill its container */
  fullWidth?: boolean
  /** Controlled selected state for toggle and pill variants */
  active?: boolean
  children?: ReactNode
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        fill="currentColor"
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  active = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-pressed={variant === 'toggle' || variant === 'pill' ? active : undefined}
      className={cx(
        // ── Layout ────────────────────────────────────────────────────────
        variant === 'toggle'
          ? 'flex flex-col items-start'
          : 'inline-flex items-center justify-center gap-2',

        // ── Shared base ───────────────────────────────────────────────────
        'font-medium transition-all duration-[var(--transition-duration-base)]',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-primary focus-visible:ring-offset-2',

        // ── Variant styles ────────────────────────────────────────────────
        variant === 'primary' && cx(
          'rounded-md font-semibold',
          'bg-primary text-on-primary shadow-1',
          'hover:bg-primary-hover hover:shadow-2 active:scale-[0.99]',
          'disabled:bg-surface-container-high disabled:text-text-muted',
          'disabled:shadow-none disabled:cursor-not-allowed',
        ),

        variant === 'secondary' && cx(
          'rounded-md border border-border bg-surface-card text-text-secondary',
          'hover:bg-surface-container hover:border-border-strong',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        ),

        variant === 'toggle' && cx(
          'w-full rounded-lg border-2 text-left',
          'disabled:cursor-not-allowed',
          active
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-border bg-surface-card text-text-primary hover:border-border-strong',
        ),

        variant === 'pill' && cx(
          'rounded-full border',
          'disabled:cursor-not-allowed',
          active
            ? 'border-primary bg-primary text-on-primary'
            : 'border-border bg-surface-card text-text-secondary hover:border-border-strong',
        ),

        variant === 'icon' && cx(
          'rounded-md text-text-muted',
          'hover:text-text-primary hover:bg-surface-container',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        ),

        variant === 'text' && cx(
          'rounded underline-offset-2 text-text-secondary',
          'hover:text-text-primary hover:underline',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        ),

        // ── Size ─────────────────────────────────────────────────────────
        size === 'sm' && variant === 'primary'   && 'px-3 py-1.5 text-xs',
        size === 'sm' && variant === 'secondary' && 'px-3 py-1.5 text-xs',
        size === 'sm' && variant === 'toggle'    && 'px-3 py-2 text-xs',
        size === 'sm' && variant === 'pill'      && 'px-2.5 py-0.5 text-xs',
        size === 'sm' && variant === 'icon'      && 'p-1',
        size === 'sm' && variant === 'text'      && 'text-xs',

        size === 'md' && variant === 'primary'   && 'px-3.5 py-2 text-sm',
        size === 'md' && variant === 'secondary' && 'px-3.5 py-2 text-sm',
        size === 'md' && variant === 'toggle'    && 'px-4 py-3 text-sm',
        size === 'md' && variant === 'pill'      && 'px-3 py-1 text-xs',
        size === 'md' && variant === 'icon'      && 'p-1.5',
        size === 'md' && variant === 'text'      && 'text-sm',

        size === 'lg' && variant === 'primary'   && 'px-5 py-2.5 text-sm',
        size === 'lg' && variant === 'secondary' && 'px-5 py-2.5 text-sm',
        size === 'lg' && variant === 'toggle'    && 'px-5 py-3.5 text-sm',
        size === 'lg' && variant === 'pill'      && 'px-4 py-1.5 text-sm',
        size === 'lg' && variant === 'icon'      && 'p-2',
        size === 'lg' && variant === 'text'      && 'text-base',

        // ── Width ─────────────────────────────────────────────────────────
        fullWidth && 'w-full',

        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export default Button
