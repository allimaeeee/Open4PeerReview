function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface FilterPillProps {
  label: string
  count?: number
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function FilterPill({ label, count, selected = false, onClick, className }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 border',
        'text-label-sm font-label font-semibold uppercase tracking-widest',
        'transition-colors duration-150',
        selected
          ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-primary)]'
          : 'bg-[var(--color-surface-container)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
        className
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cx(
            'rounded-full px-1.5 leading-none',
            selected ? 'bg-white/15' : 'bg-[var(--color-surface-container-high)]'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
