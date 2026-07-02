function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

type Variant = 'draft' | 'unassigned' | 'assigned' | 'under-review' | 'feedback-ready' | 'certified' | 'not-started' | 'in-progress' | 'completed'

interface StatusBadgeProps {
  variant: Variant
  size?: 'default' | 'compact'
  className?: string
}

const VARIANTS: Record<Variant, { label: string; bg: string; text: string }> = {
  draft:            { label: 'Draft',          bg: 'var(--color-status-draft-bg)',           text: 'var(--color-status-draft-text)' },
  unassigned:       { label: 'Unassigned',     bg: 'var(--color-status-unassigned-bg)',       text: 'var(--color-status-unassigned-text)' },
  assigned:         { label: 'Assigned',       bg: 'var(--color-status-assigned-bg)',         text: 'var(--color-status-assigned-text)' },
  'under-review':   { label: 'Under Review',   bg: 'var(--color-status-under-review-bg)',     text: 'var(--color-status-under-review-text)' },
  'feedback-ready': { label: 'Feedback Ready', bg: 'var(--color-status-feedback-ready-bg)',   text: 'var(--color-status-feedback-ready-text)' },
  certified:        { label: 'Certified',      bg: 'var(--color-status-certified-bg)',        text: 'var(--color-status-certified-text)' },
  'not-started':    { label: 'Not Started',    bg: 'var(--color-status-not-started-bg)',      text: 'var(--color-status-not-started-text)' },
  'in-progress':    { label: 'In Progress',    bg: 'var(--color-status-in-progress-bg)',      text: 'var(--color-status-in-progress-text)' },
  completed:        { label: 'Completed',      bg: 'var(--color-status-completed-bg)',        text: 'var(--color-status-completed-text)' },
}

export function StatusBadge({ variant, size = 'default', className }: StatusBadgeProps) {
  const config = VARIANTS[variant]

  return (
    <span
      className={cx(
        'inline-flex items-center uppercase tracking-widest font-label font-semibold text-label-sm rounded-sm',
        size === 'compact' ? 'px-1.5 py-0.5 gap-1' : 'px-2.5 py-0.5 gap-1.5',
        className
      )}
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <span
        className={cx(
          'rounded-full bg-current opacity-70',
          size === 'compact' ? 'w-1 h-1' : 'w-1.5 h-1.5'
        )}
      />
      {config.label}
    </span>
  )
}
