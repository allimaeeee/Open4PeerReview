'use client'

import { useState, useRef, useEffect } from 'react'
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

  useEffect(() => {
    if (!isDragging) return

    function onMouseMove(e: MouseEvent) {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100
      const minLeftPercent = (minLeftWidth / rect.width) * 100
      const minRightPercent = (minRightWidth / rect.width) * 100
      const clamped = Math.min(Math.max(newPercent, minLeftPercent), 100 - minRightPercent)
      setLeftPercent(clamped)
    }

    function onMouseUp() {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, minLeftWidth, minRightWidth])

  const leftWidth = leftCollapsed ? 0 : `${leftPercent}%`
  const leftFlex = rightCollapsed ? '1 1 0%' : undefined

  return (
    <div
      ref={containerRef}
      className={`flex flex-row h-full overflow-hidden${isDragging ? ' select-none cursor-col-resize' : ''}`}
    >
      {/* Left panel */}
      <div
        style={{
          width: leftFlex ? undefined : leftWidth,
          flex: leftFlex,
          overflow: leftCollapsed ? 'hidden' : undefined,
          flexShrink: 0,
        }}
        className="h-full overflow-y-auto"
      >
        {leftPanel}
      </div>

      {/* Divider */}
      <div
        className="relative h-full flex-shrink-0 cursor-col-resize"
        style={{ width: 12 }}
        onMouseDown={() => setIsDragging(true)}
      >
        <div className="w-px h-full bg-border mx-auto" />

        {/* Collapse left button */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setLeftCollapsed(v => !v) }}
          onMouseDown={e => e.stopPropagation()}
          className="absolute left-1/2 -translate-x-1/2 top-8 w-5 h-5 rounded-sm bg-surface-card border border-border flex items-center justify-center cursor-pointer hover:bg-surface-container-low"
          aria-label={leftCollapsed ? 'Expand left panel' : 'Collapse left panel'}
        >
          {leftCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>

        {/* Collapse right button */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setRightCollapsed(v => !v) }}
          onMouseDown={e => e.stopPropagation()}
          className="absolute left-1/2 -translate-x-1/2 top-16 w-5 h-5 rounded-sm bg-surface-card border border-border flex items-center justify-center cursor-pointer hover:bg-surface-container-low"
          aria-label={rightCollapsed ? 'Expand right panel' : 'Collapse right panel'}
        >
          {rightCollapsed ? <ChevronLeft /> : <ChevronRight />}
        </button>
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
