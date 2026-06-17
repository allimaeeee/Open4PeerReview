'use client'

import type { ReactNode } from 'react'

export interface ChipGroupProps {
  label: string
  children: ReactNode
  className?: string
}

export function ChipGroup({ label, children, className }: ChipGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={['flex flex-wrap gap-1.5', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  )
}

export default ChipGroup
