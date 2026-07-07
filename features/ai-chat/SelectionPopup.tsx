'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAIChat } from './AIChatContext'
import { useSelectionDetector } from './useSelectionDetector'
import { useAIChatLogger } from './logging/AIChatLoggerContext'

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="w-3 h-3 flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M6 1v10M1 6h10" />
    </svg>
  )
}

export function SelectionPopup() {
  const { addContextSnippet, openPanel, state } = useAIChat()
  const selection = useSelectionDetector()
  const log = useAIChatLogger()
  const prevHadSelectionRef = useRef(false)

  // Log when the popup transitions from hidden → visible (null → non-null)
  useEffect(() => {
    const hasSelection = selection !== null
    if (hasSelection && !prevHadSelectionRef.current) {
      log('selection_popup_shown', { text_length: selection!.text.length })
    }
    prevHadSelectionRef.current = hasSelection
  }, [selection, log])

  if (!selection) return null

  const { text, rect } = selection

  const top  = rect.top  - 44
  const left = rect.left + rect.width / 2

  function handleClick() {
    log('context_added', {
      text_length: text.length,
      snippet_count_after: state.contextSnippets.length + 1,
    })
    addContextSnippet(text)
    openPanel()
    window.getSelection()?.removeAllRanges()
  }

  return createPortal(
    <button
      onMouseDown={e => e.preventDefault()}
      onClick={handleClick}
      style={{
        position: 'fixed',
        top,
        left,
        transform: 'translateX(-50%)',
        zIndex: 9999,
      }}
      className="ai-popup-enter inline-flex items-center gap-2 bg-[var(--ai-popup-bg)] text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-[0px_4px_16px_rgba(0,0,0,0.18)] cursor-pointer hover:opacity-90 transition-opacity duration-[120ms] select-none"
    >
      <PlusIcon />
      Ask AI
    </button>,
    document.body,
  )
}
