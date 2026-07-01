'use client'

import { createPortal } from 'react-dom'
import { useAIChat } from './AIChatContext'
import { useSelectionDetector } from './useSelectionDetector'

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
  const { addContextSnippet, openPanel } = useAIChat()
  const selection = useSelectionDetector()

  if (!selection) return null

  const { text, rect } = selection

  const top  = rect.top  + window.scrollY - 44
  const left = rect.left + window.scrollX + rect.width / 2

  function handleClick() {
    addContextSnippet(text)
    openPanel()
    window.getSelection()?.removeAllRanges()
  }

  return createPortal(
    <button
      onMouseDown={e => e.preventDefault()} // prevent focus loss killing the selection
      onClick={handleClick}
      style={{
        position: 'absolute',
        top,
        left,
        transform: 'translateX(-50%)',
        zIndex: 9999,
      }}
      className="inline-flex items-center gap-2 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl cursor-pointer hover:bg-gray-800 transition-all duration-150 select-none"
    >
      <PlusIcon />
      Add to context
    </button>,
    document.body,
  )
}
