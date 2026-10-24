function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export interface ProgressBarProps {
  value: number
  showLabel?: boolean
  label?: string
  className?: string
}

export function ProgressBar({ value, showLabel = true, label, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={cx('flex items-center gap-3 w-full', className)}>
      <div className="flex-1 h-1 bg-[var(--color-surface-container-high)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-150"
          style={{ width: `${clamped}%`, backgroundColor: 'var(--color-secondary)' }}
        />
      </div>
      {showLabel && (
        <span className="text-label-sm font-label text-text-secondary whitespace-nowrap">
          {label ?? `${clamped}% complete`}
        </span>
      )}
    </div>
  )
}
