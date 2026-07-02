import { Button } from '@/components/ui/Button'

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface NavItem {
  id: string
  label: string
  count?: number
}

interface DashboardSidebarProps {
  title: string
  activeItem: string
  items: NavItem[]
  onNavigate: (id: string) => void
  ctaLabel?: string
  onCtaClick?: () => void
}

export function DashboardSidebar({
  title,
  activeItem,
  items,
  onNavigate,
  ctaLabel,
  onCtaClick,
}: DashboardSidebarProps) {
  return (
    <div className="flex flex-col h-full p-4">

      {ctaLabel && (
        <Button variant="primary" size="md" fullWidth onClick={onCtaClick} className="mb-6">
          {ctaLabel}
        </Button>
      )}

      <p className="text-label-sm font-label font-semibold uppercase tracking-widest text-text-muted mb-3">
        {title}
      </p>

      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          className={cx(
            'w-full text-left px-3 py-2 rounded-md text-body-md transition-colors cursor-pointer flex items-center justify-between',
            activeItem === item.id
              ? 'bg-surface-container text-text-primary font-medium'
              : 'text-text-secondary hover:bg-surface-container hover:text-text-primary'
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="text-label-sm font-label font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-surface-container-high)] text-text-muted leading-none">
              {item.count}
            </span>
          )}
        </button>
      ))}

    </div>
  )
}
