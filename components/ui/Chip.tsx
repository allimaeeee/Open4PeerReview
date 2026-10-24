'use client'

export type ChipVariant = 'suggestion' | 'selected'

export interface ChipProps {
  label: string
  variant: ChipVariant
  onClick?: () => void
  onRemove?: () => void
  disabled?: boolean
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 10 10" fill="none" aria-hidden="true" className="w-3 h-3">
      <path
        d="M1.5 1.5l7 7M8.5 1.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Chip({ label, variant, onClick, onRemove, disabled }: ChipProps) {
  if (variant === 'suggestion') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={[
          'inline-flex items-center gap-1 rounded-full border px-3 py-1',
          'text-body-sm border-border text-text-secondary',
          'transition-colors',
          'hover:border-border-strong hover:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-40',
        ].join(' ')}
      >
        <span aria-hidden="true">+</span>
        {label}
      </button>
    )
  }

  return (
    <span className={[
      'inline-flex items-center gap-1 rounded-full bg-primary text-on-primary text-body-sm font-medium px-3 py-1',
      disabled && 'opacity-40',
    ].filter(Boolean).join(' ')}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${label}`}
        className={[
          'ml-0.5 leading-none',
          'text-on-primary/70 hover:text-on-primary',
          'transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        <CloseIcon />
      </button>
    </span>
  )
}

export default Chip
