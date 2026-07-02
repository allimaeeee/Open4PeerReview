'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface ViewerPanelHeaderProps {
  onBack: () => void
  centerSlot?: ReactNode
}

export function ViewerPanelHeader({ onBack, centerSlot }: ViewerPanelHeaderProps) {
  return (
    <div className="relative flex items-center flex-shrink-0 bg-surface-card border-b border-border px-4 py-2">
      {/* Left — back button (static in flow) */}
      <Button variant="secondary" onClick={onBack}>
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to dashboard
      </Button>

      {/* Center — absolutely positioned so it's always visually centered */}
      {centerSlot != null && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
          {centerSlot}
        </div>
      )}
    </div>
  )
}

export default ViewerPanelHeader
