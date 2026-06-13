'use client'

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export interface TabBarProps {
  tabs: { id: string; label: string }[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}

export function TabBar({ tabs, activeId, onChange, className }: TabBarProps) {
  return (
    <div role="tablist" className={cx('flex border-b border-border', className)}>
      {tabs.map(tab => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => { if (!active) onChange(tab.id) }}
            className={cx(
              'px-4 py-2.5 text-body-sm font-body -mb-px border-b-2 transition-colors duration-[var(--transition-duration-fast)] whitespace-nowrap',
              active
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default TabBar
