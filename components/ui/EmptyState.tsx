function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface EmptyStateProps {
  message: string
  sub?: string
  className?: string
}

export function EmptyState({ message, sub, className }: EmptyStateProps) {
  return (
    <div className={cx(
      'rounded-lg border-2 border-dashed border-[var(--color-border)] py-16 text-center',
      className
    )}>
      <p className="text-body-md font-medium text-text-secondary">{message}</p>
      {sub && <p className="text-body-sm text-text-muted mt-1">{sub}</p>}
    </div>
  )
}
