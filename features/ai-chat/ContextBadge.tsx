'use client'

import type { ContextSnippet } from './AIChatContext'

interface Props {
  snippets: ContextSnippet[]
  onRemove: (id: string) => void
}

const MAX_DISPLAY_CHARS = 60

function truncate(text: string) {
  return text.length > MAX_DISPLAY_CHARS
    ? text.slice(0, MAX_DISPLAY_CHARS) + '…'
    : text
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="w-2.5 h-2.5 flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M2 2l6 6M8 2L2 8" />
    </svg>
  )
}

export function ContextBadge({ snippets, onRemove }: Props) {
  if (snippets.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {snippets.map(snippet => (
        <span
          key={snippet.id}
          className="ai-badge-enter inline-flex items-center gap-1.5 bg-[rgba(254,214,91,0.18)] text-text-secondary text-xs font-medium px-2.5 py-1.5 rounded-full border border-[rgba(254,214,91,0.4)] max-w-full"
        >
          <span className="truncate">{truncate(snippet.text)}</span>
          <button
            type="button"
            onClick={() => onRemove(snippet.id)}
            className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors duration-[120ms]"
            aria-label="Remove context"
          >
            <XIcon />
          </button>
        </span>
      ))}
    </div>
  )
}
