'use client'

import type { ReactNode } from 'react'
import { Checkbox } from './Checkbox'
import { Radio } from './Radio'

export type SelectionMode = 'checkbox' | 'radio'

export interface SelectionCardProps {
  selectionMode: SelectionMode
  isSelected: boolean
  onChange: () => void
  disabled?: boolean
  comingSoon?: boolean
  icon?: ReactNode
  title: string
  description?: string
  size?: 'default' | 'compact'
  className?: string
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function SelectionCard({
  selectionMode,
  isSelected,
  onChange,
  disabled,
  comingSoon,
  icon,
  title,
  description,
  size = 'default',
  className,
}: SelectionCardProps) {
  const isInteractive = !disabled && !comingSoon

  return (
    <label
      className={cx(
        'relative flex items-start gap-4 rounded-md border-2 transition-colors select-none',
        size === 'default' ? 'p-4' : 'p-3',
        isInteractive && isSelected && 'border-primary bg-primary/5 cursor-pointer',
        isInteractive && !isSelected && 'border-border hover:border-border-strong cursor-pointer',
        disabled && !comingSoon && 'border-border cursor-not-allowed',
        comingSoon && 'border-border opacity-60 cursor-default',
        className,
      )}
    >
      {/* Icon slot — optional, left, visually decorative */}
      {icon && (
        <span aria-hidden="true" className={cx(
          'flex-shrink-0 mt-0.5 w-5 h-5 text-text-primary',
          disabled && !comingSoon && 'opacity-40',
        )}>
          {icon}
        </span>
      )}

      {/* Text block */}
      <div className={cx('flex-1 min-w-0', disabled && !comingSoon && 'opacity-40')}>
        <p className="text-body-md font-medium text-text-primary leading-snug">{title}</p>
        {description && (
          <p className="text-body-sm text-text-muted mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>

      {/* Right slot: coming-soon badge or selection indicator */}
      {comingSoon ? (
        <span className="flex-shrink-0 text-body-sm font-medium uppercase tracking-widest text-text-muted border border-border rounded-full px-2.5 py-0.5">
          Coming soon
        </span>
      ) : selectionMode === 'checkbox' ? (
        <Checkbox
          checked={isSelected}
          onChange={() => onChange()}
          disabled={disabled}
        />
      ) : (
        <Radio
          checked={isSelected}
          onChange={() => onChange()}
          disabled={disabled}
        />
      )}
    </label>
  )
}

export default SelectionCard
