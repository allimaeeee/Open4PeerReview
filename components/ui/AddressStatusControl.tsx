'use client'

import type { FeedbackResponseStatus } from '@/types'

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

interface AddressStatusControlProps {
  status: FeedbackResponseStatus | null
  onChange: (status: FeedbackResponseStatus | null) => void
  disabled?: boolean
  className?: string
}

// Design tokens per state (see app/globals.css). Addressed → success/green,
// Will address later → in-progress/gold. Inactive buttons are quiet outlines.
const OPTION_CONFIG: Record<
  FeedbackResponseStatus,
  { label: string; activeBg: string; activeText: string; activeBorder: string }
> = {
  addressed: {
    label: 'Addressed',
    activeBg: 'var(--color-status-completed-bg)',
    activeText: 'var(--color-status-completed-text)',
    activeBorder: 'var(--color-status-completed-text)',
  },
  will_address_later: {
    label: 'Will address later',
    activeBg: 'var(--color-status-in-progress-bg)',
    activeText: 'var(--color-status-in-progress-text)',
    activeBorder: 'var(--color-status-in-progress-text)',
  },
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.5 3.5L13 4.5" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 1.5" />
    </svg>
  )
}

const OPTIONS: FeedbackResponseStatus[] = ['addressed', 'will_address_later']

/**
 * Author-only three-state control (none / addressed / will address later).
 * Clicking the active option clears it back to "none".
 */
export function AddressStatusControl({ status, onChange, disabled, className }: AddressStatusControlProps) {
  return (
    <div
      className={cx('flex flex-wrap items-center gap-1.5', className)}
      data-print-hide
      role="group"
      aria-label="Mark this feedback"
    >
      {OPTIONS.map(option => {
        const cfg = OPTION_CONFIG[option]
        const active = status === option
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(active ? null : option)}
            className={cx(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-label font-semibold border transition-colors',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              !active && !disabled && 'hover:bg-[var(--color-surface-container)]'
            )}
            style={
              active
                ? { backgroundColor: cfg.activeBg, color: cfg.activeText, borderColor: cfg.activeBorder }
                : {
                    backgroundColor: 'transparent',
                    color: 'var(--color-text-muted)',
                    borderColor: 'var(--color-border)',
                  }
            }
          >
            {option === 'addressed' ? <CheckIcon /> : <ClockIcon />}
            {cfg.label}
          </button>
        )
      })}
    </div>
  )
}
