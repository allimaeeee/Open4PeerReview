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
}

export function Accordion({ trigger, children, defaultOpen = false, className }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cx('rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] shadow-[var(--shadow-1)]', className)}>
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <div className="flex-1 min-w-0">{trigger}</div>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className={cx(
            'shrink-0 ml-3 w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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
