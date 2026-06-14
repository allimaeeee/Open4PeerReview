'use client'

import type { ReactNode } from 'react'

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export interface TabBarProps {
  tabs: { id: string; label: string; badge?: ReactNode }[]
  activeId: string
  onChange: (id: string) => void
  rightSlot?: ReactNode
  className?: string
}

export function TabBar({ tabs, activeId, onChange, rightSlot, className }: TabBarProps) {
  return (
    <div className={cx('flex items-center border-b border-border bg-surface-card', className)}>
      {/* Scrollable tab strip */}
      <div className="flex-1 flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                'inline-flex items-center gap-2 px-4 py-2.5 text-body-sm font-body -mb-px border-b-2 transition-colors duration-[var(--transition-duration-fast)] whitespace-nowrap flex-shrink-0',
                active
                  ? 'border-primary text-primary font-semibold bg-surface'
                  : 'border-transparent text-text-muted hover:text-text-primary hover:border-border',
              )}
            >
              {tab.label}
              {tab.badge}
            </button>
          )
        })}
      </div>

      {/* Pinned right slot — does not scroll with tabs */}
      {rightSlot && (
        <div className="flex-shrink-0 border-l border-border px-3 flex items-center self-stretch">
          {rightSlot}
        </div>
      )}
    </div>
  )
}

export default TabBar
