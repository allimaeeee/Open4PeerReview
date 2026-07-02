'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useAIChat } from './AIChatContext'
import { useChatContext } from './useChatContext'
import { ChatMessages } from './ChatMessages'
import { ContextBadge } from './ContextBadge'
import { ShortcutPills } from './ShortcutPills'
import { AIMascot } from './AIMascot'
import { useAIChatLogger } from './logging/AIChatLoggerContext'
import { usePanelResize } from './usePanelResize'

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

// ── Close icon ────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M3 3l10 10M13 3L3 13" />
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
        'bg-surface-card border border-border',
        'shadow-[0px_4px_12px_rgba(28,28,24,0.06)]',
        'hover:bg-surface-container-low transition-colors duration-[120ms]',
        'rounded-l-lg',
      ].join(' ')}
      style={{ width: 28, height: 64, left: -28 }}
    >
      <span
        className="text-[11px] font-semibold text-text-muted tracking-widest uppercase"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        AI
      </span>
    </button>
  )
}

// ── AIChatPanel ───────────────────────────────────────────────────────────────

export function AIChatPanel() {
  const { state, togglePanel, closePanel, addMessage, removeContextSnippet, setLoading, clearChat } = useAIChat()
  const { shortcuts, reviewData } = useChatContext()
  const log = useAIChatLogger()

  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { width: panelWidth, isDragging, handleMouseDown: handleResizeMouseDown } = usePanelResize(360)

  const hasMessages = state.messages.length > 0

  useEffect(() => {
    document.body.classList.toggle('ai-panel-open', state.isOpen)
    return () => { document.body.classList.remove('ai-panel-open') }
  }, [state.isOpen])

  function handleToggle() {
    log('panel_toggle', { action: state.isOpen ? 'close' : 'open' })
    togglePanel()
  }

  function handleClose() {
    log('panel_toggle', { action: 'close' })
    closePanel()
  }

  function handleRemoveSnippet(id: string) {
    log('context_removed', { remaining_count: state.contextSnippets.length - 1 })
    removeContextSnippet(id)
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || state.isLoading) return

    const hasContext = state.contextSnippets.length > 0
    const contextCount = state.contextSnippets.length

    setDraft('')
    addMessage('user', text)
    setLoading(true)
    log('message_sent', { has_context: hasContext, context_count: contextCount })

    const startTime = Date.now()
    try {
      const contextBlock = hasContext
        ? `\n\nContext from the reviewer:\n${state.contextSnippets.map(s => `"${s.text}"`).join('\n')}`
        : ''
      const fullPrompt = text + contextBlock

      const { callAI } = await import('./shortcuts/aiService')
      const response = await callAI(fullPrompt)
      addMessage('ai', response)
      log('response_received', {
        response_time_ms: Date.now() - startTime,
        trigger: 'freeform',
        context_source: hasContext ? 'selection_popup' : 'no_context',
      })
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
    <div
      className={[
        'fixed top-0 right-0 h-screen flex flex-col bg-surface-card',
        'border-l border-border',
        'shadow-[0px_8px_24px_rgba(28,28,24,0.08)]',
        'transition-transform duration-[320ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)]',
        state.isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
      style={{ width: panelWidth, zIndex: 'var(--z-modal)' as string }}
    >
      {/* Drag-to-resize handle — invisible hit area on the left edge */}
      <div
        onMouseDown={handleResizeMouseDown}
        className={[
          'absolute top-0 left-0 h-full w-[7px] cursor-col-resize z-10',
          isDragging ? 'border-l border-[rgba(196,198,205,0.4)]' : '',
        ].join(' ')}
      />

      {/* Toggle tab */}
      <ToggleTab isOpen={state.isOpen} onClick={handleToggle} />

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-[rgba(196,198,205,0.3)]">
        <span className="text-[13px] font-semibold text-text-primary">AI Assistant</span>
        <div className="flex items-center gap-3">
          {hasMessages && (
            <button
              onClick={clearChat}
              className="text-[12px] text-text-muted hover:text-text-secondary transition-colors duration-[120ms] font-medium"
            >
              New chat
            </button>
          )}
          <button
            onClick={handleClose}
            className="text-text-muted hover:text-text-primary transition-colors duration-[120ms]"
            aria-label="Close AI panel"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {hasMessages ? (
          <ChatMessages messages={state.messages} isLoading={state.isLoading} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-8 flex-1 h-full">
            <AIMascot state="idle" className="w-16 h-20" />
            <p className="text-sm font-medium text-text-muted mt-4 text-center">
              How can I help?
            </p>
          </div>
        )}
      </div>

      {/* ── Shortcut pills + input ── */}
      <div className="flex-shrink-0">
        <ShortcutPills shortcuts={shortcuts} reviewData={reviewData} />

        {/* ── Input area ── */}
        <div className="px-4 pb-4 pt-1">
        <div
          className="rounded-xl bg-[#faf9f6] px-3.5 py-4"
        >
          <ContextBadge snippets={state.contextSnippets} onRemove={handleRemoveSnippet} />

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
                'text-sm text-text-primary placeholder:text-text-muted leading-relaxed',
                'disabled:opacity-60',
              ].join(' ')}
              style={{ minHeight: 22, maxHeight: 120 }}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || state.isLoading}
              className={[
                'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md transition-all duration-[120ms]',
                draft.trim() && !state.isLoading
                  ? 'bg-secondary-container text-text-primary hover:opacity-90 active:scale-[0.97]'
                  : 'bg-surface-card text-border cursor-not-allowed',
              ].join(' ')}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>

          <p className="mt-1.5 text-[10px] text-text-muted opacity-60">Cmd+Enter to send</p>
        </div>
        </div>
      </div>
    </div>
  )
}
