function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface StatCardProps {
  value: string | number
  label: string
  className?: string
}

export function StatCard({ value, label, className }: StatCardProps) {
  return (
    <div className={cx(
      'rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-card)]',
      'shadow-[var(--shadow-1)] p-5 text-center',
      className
    )}>
      <p className="font-heading text-heading-lg text-text-primary">{value}</p>
      <p className="text-label-md font-label uppercase tracking-wide text-text-muted mt-1">{label}</p>
    </div>
  )
}
