function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export interface RubricTagProps {
  label: string
  variant?: 'plain' | 'filled' | 'outlined'
  className?: string
}

export function RubricTag({ label, variant = 'plain', className }: RubricTagProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center px-2.5 py-0.5 rounded-sm text-label-sm font-label font-semibold uppercase tracking-widest',
        variant === 'plain'  && 'bg-transparent text-text-secondary',
        variant === 'filled'   && 'bg-[var(--color-surface-container-high)] text-text-secondary',
        variant === 'outlined' && 'bg-transparent border border-[var(--color-border)] text-text-secondary',
        className,
      )}
    >
      {label}
    </span>
  )
}
