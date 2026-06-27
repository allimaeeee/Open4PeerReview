'use client'

import { useState, useRef } from 'react'
import type { ReactNode } from 'react'

interface ResizablePanelLayoutProps {
  leftPanel: ReactNode
  rightPanel: ReactNode
  defaultLeftPercent?: number
  minLeftWidth?: number
  minRightWidth?: number
  defaultLeftCollapsed?: boolean
  leftPanelLabel?: string
  rightPanelLabel?: string
  // Controlled collapse — when provided, parent owns left-panel collapsed state
  leftPanelCollapsed?: boolean
  onLeftPanelCollapsedChange?: (v: boolean) => void
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
  defaultLeftCollapsed = false,
  leftPanelLabel,
  rightPanelLabel,
  leftPanelCollapsed,
  onLeftPanelCollapsedChange,
}: ResizablePanelLayoutProps) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent)
  const [internalLeftCollapsed, setInternalLeftCollapsed] = useState(defaultLeftCollapsed)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Support both controlled and uncontrolled left-panel collapse
  const isLeftControlled = leftPanelCollapsed !== undefined
  const leftCollapsed = isLeftControlled ? leftPanelCollapsed! : internalLeftCollapsed
  function setLeftCollapsed(v: boolean) {
    if (isLeftControlled) onLeftPanelCollapsedChange?.(v)
    else setInternalLeftCollapsed(v)
  }
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

  const canDrag = !leftCollapsed && !rightCollapsed

  // Each panel's right/left edge sits exactly at the split point, so panel
  // backgrounds fill their respective halves of the transparent 12px divider.
  const dividerStyle: React.CSSProperties = leftCollapsed
    ? { position: 'absolute', top: 0, bottom: 0, left: 0, width: 12, zIndex: 10 }
    : rightCollapsed
    ? { position: 'absolute', top: 0, bottom: 0, right: 0, width: 12, zIndex: 10 }
    : { position: 'absolute', top: 0, bottom: 0, left: `calc(${leftPercent}% - 6px)`, width: 12, zIndex: 10 }

  return (
    <div
      ref={containerRef}
      className={`relative h-full overflow-hidden${isDragging ? ' select-none cursor-col-resize' : ''}`}
    >
      {/* Left panel — right edge at split point, covering the left half of the divider */}
      {!leftCollapsed && (
        <div
          className="absolute inset-y-0 overflow-y-auto"
          style={{
            left: 0,
            right: rightCollapsed ? 0 : `calc(100% - ${leftPercent}%)`,
          }}
        >
          {leftPanel}
        </div>
      )}

      {/* Divider — transparent except for the 1px center line; sits above both panels via z-index */}
      <div
        style={dividerStyle}
        className={canDrag ? 'cursor-col-resize' : undefined}
        onPointerDown={canDrag ? handlePointerDown : undefined}
        onPointerMove={canDrag ? handlePointerMove : undefined}
        onPointerUp={canDrag ? handlePointerUp : undefined}
      >
        <div className="w-px h-full bg-border mx-auto" />

        {/* Left-face button — hangs into left panel. Always shows ‹.
            Normal: collapse left. Right-collapsed: expand right (right face is hidden).
            Guarded: won't collapse left if right is already collapsed.
            When right is collapsed with a label, renders as a vertical tab instead. */}
        {!leftCollapsed && (
          rightCollapsed && rightPanelLabel ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setRightCollapsed(false) }}
              onPointerDown={e => e.stopPropagation()}
              className="absolute top-0 left-1.5 -translate-x-full flex flex-col items-center gap-2 px-1.5 py-3 bg-surface-card border border-r-0 border-border rounded-l-md cursor-pointer hover:bg-surface-container-low"
              aria-label={`Expand: ${rightPanelLabel}`}
            >
              <ChevronLeft />
              <span
                className="text-label-sm font-label font-semibold uppercase tracking-widest text-text-secondary whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {rightPanelLabel}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                if (rightCollapsed) setRightCollapsed(false)
                else setLeftCollapsed(true)
              }}
              onPointerDown={e => e.stopPropagation()}
              className="absolute top-0 left-1.5 -translate-x-full w-5 h-5 rounded-sm bg-surface-card border border-border flex items-center justify-center cursor-pointer hover:bg-surface-container-low"
              aria-label={rightCollapsed ? 'Expand right panel' : 'Collapse left panel'}
            >
              <ChevronLeft />
            </button>
          )
        )}

        {/* Right-face button — hangs into right panel. Always shows ›.
            Normal: collapse right. Left-collapsed: expand left (left face is hidden).
            Guarded: won't collapse right if left is already collapsed.
            When left is collapsed with a label, renders as a vertical tab instead. */}
        {!rightCollapsed && (
          leftCollapsed && leftPanelLabel ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setLeftCollapsed(false) }}
              onPointerDown={e => e.stopPropagation()}
              className="absolute top-0 right-1.5 translate-x-full flex flex-col items-center gap-2 px-1.5 py-3 bg-surface-card border border-l-0 border-border rounded-r-md cursor-pointer hover:bg-surface-container-low"
              aria-label={`Expand: ${leftPanelLabel}`}
            >
              <ChevronRight />
              <span
                className="text-label-sm font-label font-semibold uppercase tracking-widest text-text-secondary whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {leftPanelLabel}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                if (leftCollapsed) setLeftCollapsed(false)
                else setRightCollapsed(true)
              }}
              onPointerDown={e => e.stopPropagation()}
              className="absolute top-0 right-1.5 translate-x-full w-5 h-5 rounded-sm bg-surface-card border border-border flex items-center justify-center cursor-pointer hover:bg-surface-container-low"
              aria-label={leftCollapsed ? 'Expand left panel' : 'Collapse right panel'}
            >
              <ChevronRight />
            </button>
          )
        )}
      </div>

      {/* Right panel — left edge at split point, covering the right half of the divider */}
      {!rightCollapsed && (
        <div
          className="absolute inset-y-0 overflow-y-auto"
          style={{
            left: leftCollapsed ? 0 : `${leftPercent}%`,
            right: 0,
          }}
        >
          {rightPanel}
        </div>
      )}
    </div>
  )
}
