'use client'

import type { HighlightTag } from '@/types'

function ClipboardListIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>
    </svg>
  )
}

function ZapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

const TAG_OPTIONS = [
  { value: 'action_item' as HighlightTag, label: 'Action Item', Icon: ClipboardListIcon },
  { value: 'quick_fix'   as HighlightTag, label: 'Quick Fix',   Icon: ZapIcon },
]

/** Static display chip — for view mode. */
export function TagChip({ tag, compact }: { tag: string; compact?: boolean }) {
  const opt = TAG_OPTIONS.find(o => o.value === tag)
  if (!opt) return null
  const { label, Icon } = opt
  return (
    <span className={`self-start inline-flex items-center gap-1 ${compact ? 'px-1.5 py-0 leading-none' : 'px-2 py-0.5'} rounded-full text-body-sm bg-secondary-container/60 text-secondary border border-secondary/40`}>
      <Icon />
      {label}
    </span>
  )
}

interface TagSelectorProps {
  value: HighlightTag | null
  onChange: (tag: HighlightTag | null) => void
  compact?: boolean
}

/** Interactive toggle row — for edit / add forms. */
export function TagSelector({ value, onChange, compact }: TagSelectorProps) {
  return (
    <div className="flex gap-2">
      {TAG_OPTIONS.map(({ value: optValue, label, Icon }) => (
        <button
          key={optValue}
          type="button"
          onClick={() => onChange(value === optValue ? null : optValue)}
          className={[
            `inline-flex items-center gap-1 ${compact ? 'px-1.5 py-0 leading-none' : 'px-2 py-0.5'} rounded-full text-body-sm cursor-pointer transition-colors`,
            value === optValue
              ? 'bg-secondary-container/60 text-secondary border border-secondary/40 hover:bg-secondary-container/90 hover:border-secondary/70'
              : 'bg-transparent text-text-secondary/50 border border-border/50 hover:bg-secondary-container/20 hover:text-secondary/80 hover:border-secondary/30',
          ].join(' ')}
        >
          <Icon />
          {label}
        </button>
      ))}
    </div>
  )
}
