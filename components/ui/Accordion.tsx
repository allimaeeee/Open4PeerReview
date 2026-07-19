'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface AccordionProps {
  trigger: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
  chevronClassName?: string
  rightSlot?: ReactNode
}

export function Accordion({ trigger, children, defaultOpen = false, className, chevronClassName, rightSlot }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cx(
      'rounded-lg bg-[var(--color-surface-card)] border',
      'transition-[box-shadow,border-color,transform] duration-[var(--transition-duration-base)] ease-[var(--transition-timing-function-brand)]',
      isOpen
        ? 'border-[var(--color-border-strong)] shadow-[0_2px_8px_rgba(28,28,24,0.05),0_20px_56px_rgba(28,28,24,0.08)] -translate-y-[2px]'
        : 'border-[var(--color-border)] shadow-[var(--shadow-1)] hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-2)] hover:-translate-y-[1px]',
      className
    )}>
      <div
        className={cx('flex justify-between px-5 py-4 cursor-pointer', rightSlot ? 'items-start' : 'items-center')}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <div className="flex-1 min-w-0">{trigger}</div>
        {rightSlot ? (
          <div className="shrink-0 ml-3 flex flex-col items-end gap-2">
            <div onClick={e => e.stopPropagation()}>{rightSlot}</div>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className={cx(
                'w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200',
                isOpen && 'rotate-180',
                chevronClassName
              )}
            >
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={cx(
              'shrink-0 ml-3 w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200',
              isOpen && 'rotate-180',
              chevronClassName
            )}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
