'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { useAIChat } from './AIChatContext'
import { useChatContext } from './useChatContext'
import { ChatMessages } from './ChatMessages'
import { ContextBadge } from './ContextBadge'
import { ShortcutPills } from './ShortcutPills'

// ── Empty state SVG — 3 overlapping thin circles ──────────────────────────────

function EmptyStateArt() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 flex-1">
      <svg
        viewBox="0 0 80 80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className="w-20 h-20 text-gray-200"
        aria-hidden="true"
      >
        {/* 3 overlapping circles forming a Venn-like geometric mark */}
        <circle cx="29" cy="40" r="20" />
        <circle cx="51" cy="40" r="20" />
        <circle cx="40" cy="24" r="20" />
      </svg>
      <p className="text-sm font-medium text-gray-400 mt-4 text-center">
        How can I help?
      </p>
    </div>
  )
}

// ── Send icon ─────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M14 8H2M14 8L9 3M14 8L9 13" />
    </svg>
  )
}

// ── Panel toggle tab ──────────────────────────────────────────────────────────

function ToggleTab({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? 'Close AI panel' : 'Open AI panel'}
      className={[
        'absolute top-1/2 -translate-y-1/2 flex items-center justify-center',
        'bg-white border border-gray-100 shadow-[0_4px_12px_rgba(0,0,0,0.06)]',
        'hover:bg-gray-50 transition-colors duration-150',
        'rounded-l-lg',
        isOpen ? '-left-[29px]' : '-left-[29px]',
      ].join(' ')}
      style={{ width: 28, height: 64 }}
    >
      <span
        className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        AI
      </span>
    </button>
  )
}

// ── AIChatPanel ───────────────────────────────────────────────────────────────

export function AIChatPanel() {
  const { state, togglePanel, addMessage, addContextSnippet, removeContextSnippet, setLoading, clearChat } = useAIChat()
  const { shortcuts, reviewData } = useChatContext()

  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const hasMessages = state.messages.length > 0

  async function handleSend() {
    const text = draft.trim()
    if (!text || state.isLoading) return
    setDraft('')
    addMessage('user', text)
    setLoading(true)

    try {
      // Build a prompt that includes context snippets if any
      const contextBlock = state.contextSnippets.length > 0
        ? `\n\nContext from the reviewer:\n${state.contextSnippets.map(s => `"${s.text}"`).join('\n')}`
        : ''
      const fullPrompt = text + contextBlock

      // Phase 2: stub — import and call aiService directly
      const { callAI } = await import('./shortcuts/aiService')
      const response = await callAI(fullPrompt)
      addMessage('ai', response)
    } catch {
      addMessage('ai', 'Something went wrong. Please try again.')
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-grow textarea (max 5 lines)
  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <>
      {/* Inject keyframe for loading dots */}
      <style>{`
        @keyframes ai-chat-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50%       { opacity: 1;   transform: scale(1); }
        }
      `}</style>

      <div
        className={[
          'fixed top-0 right-0 h-screen flex flex-col bg-white',
          'border-l border-gray-100',
          'shadow-[0_20px_40px_rgba(0,0,0,0.03)]',
          'transition-transform duration-300 ease-out',
          state.isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{ width: 360, zIndex: 'var(--z-modal)' as string }}
      >
        {/* Toggle tab — always accessible on the left edge */}
        <ToggleTab isOpen={state.isOpen} onClick={togglePanel} />

        {/* ── Header ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
          <span className="text-[13px] font-semibold text-gray-800">AI Assistant</span>
          {hasMessages && (
            <button
              onClick={clearChat}
              className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors font-medium"
            >
              New chat
            </button>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {hasMessages
            ? <ChatMessages messages={state.messages} isLoading={state.isLoading} />
            : <EmptyStateArt />
          }
        </div>

        {/* ── Shortcut pills ── */}
        <ShortcutPills shortcuts={shortcuts} reviewData={reviewData} />

        {/* ── Input area ── */}
        <div className="flex-shrink-0 px-4 pb-4 pt-1">
          <div
            className={[
              'rounded-2xl border border-gray-200 bg-white px-3.5 py-3 shadow-sm',
              'focus-within:ring-1 focus-within:ring-gray-200 focus-within:border-gray-300 transition-all duration-150',
            ].join(' ')}
          >
            <ContextBadge snippets={state.contextSnippets} onRemove={removeContextSnippet} />

            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={1}
                value={draft}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this review…"
                disabled={state.isLoading}
                className={[
                  'flex-1 resize-none bg-transparent border-none outline-none ring-0',
                  'text-sm text-gray-800 placeholder-gray-400 leading-relaxed',
                  'disabled:opacity-60',
                ].join(' ')}
                style={{ minHeight: 22, maxHeight: 120 }}
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim() || state.isLoading}
                className={[
                  'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150',
                  draft.trim() && !state.isLoading
                    ? 'bg-gray-900 text-white hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed',
                ].join(' ')}
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </div>

            <p className="mt-1.5 text-[10px] text-gray-300">⌘↵ to send</p>
          </div>
        </div>
      </div>
    </>
  )
}
