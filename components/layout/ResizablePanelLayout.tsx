'use client'

import { useState, useRef } from 'react'
import type { ReactNode } from 'react'

interface ResizablePanelLayoutProps {
  leftPanel: ReactNode
  rightPanel: ReactNode
  defaultLeftPercent?: number
  minLeftWidth?: number
  minRightWidth?: number
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="w-3 h-3">
      <path d="M9 6l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="w-3 h-3">
      <path d="M7 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ResizablePanelLayout({
  leftPanel,
  rightPanel,
  defaultLeftPercent = 50,
  minLeftWidth = 320,
  minRightWidth = 360,
}: ResizablePanelLayoutProps) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Offset between cursor and the split point at the moment drag starts,
  // so the divider tracks the cursor rather than snapping to it.
  const dragOffsetRef = useRef(0)

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      dragOffsetRef.current = (e.clientX - rect.left) - (leftPercent / 100) * rect.width
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newPercent = ((e.clientX - rect.left - dragOffsetRef.current) / rect.width) * 100
    const minLeftPercent = (minLeftWidth / rect.width) * 100
    const minRightPercent = (minRightWidth / rect.width) * 100
    setLeftPercent(Math.min(Math.max(newPercent, minLeftPercent), 100 - minRightPercent))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setIsDragging(false)
  }

  const leftWidth = leftCollapsed ? 0 : `${leftPercent}%`

  return (
    <div
      ref={containerRef}
      className={`flex flex-row h-full overflow-hidden${isDragging ? ' select-none cursor-col-resize' : ''}`}
    >
      {/* Left panel */}
      <div
        style={{
          width: rightCollapsed ? undefined : leftWidth,
          flexGrow: rightCollapsed ? 1 : 0,
          flexShrink: rightCollapsed ? 1 : 0,
          flexBasis: rightCollapsed ? '0%' : undefined,
          overflow: leftCollapsed ? 'hidden' : undefined,
        }}
        className="h-full overflow-y-auto"
      >
        {leftPanel}
      </div>

      {/* Divider */}
      <div
        className="relative h-full flex-shrink-0 cursor-col-resize"
        style={{ width: 12 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="w-px h-full bg-border mx-auto" />

        {/* Left-face button — hangs into left panel. Always shows ‹.
            Normal: collapse left. Right-collapsed: expand right (right face is hidden).
            Guarded: won't collapse left if right is already collapsed. */}
        {!leftCollapsed && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              if (rightCollapsed) setRightCollapsed(false)
              else setLeftCollapsed(true)
            }}
            onPointerDown={e => e.stopPropagation()}
            className="absolute top-8 left-0 -translate-x-full w-5 h-5 rounded-sm bg-surface-card border border-border flex items-center justify-center cursor-pointer hover:bg-surface-container-low"
            aria-label={rightCollapsed ? 'Expand right panel' : 'Collapse left panel'}
          >
            <ChevronLeft />
          </button>
        )}

        {/* Right-face button — hangs into right panel. Always shows ›.
            Normal: collapse right. Left-collapsed: expand left (left face is hidden).
            Guarded: won't collapse right if left is already collapsed. */}
        {!rightCollapsed && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              if (leftCollapsed) setLeftCollapsed(false)
              else setRightCollapsed(true)
            }}
            onPointerDown={e => e.stopPropagation()}
            className="absolute top-8 right-0 translate-x-full w-5 h-5 rounded-sm bg-surface-card border border-border flex items-center justify-center cursor-pointer hover:bg-surface-container-low"
            aria-label={leftCollapsed ? 'Expand left panel' : 'Collapse right panel'}
          >
            <ChevronRight />
          </button>
        )}

      </div>

      {/* Right panel */}
      <div
        style={{ display: rightCollapsed ? 'none' : undefined }}
        className="flex-1 min-w-0 h-full overflow-y-auto"
      >
        {rightPanel}
      </div>
    </div>
  )
}
