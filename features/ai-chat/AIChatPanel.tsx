'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useAIChat, type ChatOption } from './AIChatContext'
import { useChatContext } from './useChatContext'
import { explainCriterionFollowUp, type ExplainCriterionFollowUp } from './shortcuts/explainCriterion'
import { ChatMessages } from './ChatMessages'
import { ChatHistoryList } from './ChatHistoryList'
import { ContextBadge } from './ContextBadge'
import { ShortcutPills } from './ShortcutPills'
import { AIMascot } from './AIMascot'
import { useAIChatLogger } from './logging/AIChatLoggerContext'
import { usePanelResize } from './usePanelResize'
import { RUBRIC_DISPLAY_NAMES } from './rubric-data/rubricNameMap'

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

// ── History icon ──────────────────────────────────────────────────────────────

function HistoryIcon() {
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
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  )
}

// ── AIChatPanel ───────────────────────────────────────────────────────────────

type View = 'chat' | 'history'

export function AIChatPanel() {
  const {
    state, closePanel, addMessage, removeContextSnippet, setLoading, setPendingFollowUp, clearChat,
    setScope, isViewingHistory, loadHistorySessions, openHistorySession, resumeActiveSession,
  } = useAIChat()
  const { shortcuts, reviewData, pageRole, rubricSlug, isReviewDataLoading, documentId, fetchReviewData } = useChatContext()
  const log = useAIChatLogger()

  const [draft, setDraft] = useState('')
  const [view, setView] = useState<View>('chat')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { width: panelWidth, isDragging, handleMouseDown: handleResizeMouseDown } = usePanelResize(360)

  const hasMessages = state.messages.length > 0

  useEffect(() => {
    document.body.classList.toggle('ai-panel-open', state.isOpen)
    return () => { document.body.classList.remove('ai-panel-open') }
  }, [state.isOpen])

  // Keep the persistence layer's scope in sync — it can't derive this itself
  // (see ChatScope's doc comment in AIChatContext.tsx).
  useEffect(() => {
    const reviewId = reviewData && 'reviewId' in reviewData ? reviewData.reviewId : null
    setScope({
      documentId,
      reviewId,
      pageRole,
      rubricName: rubricSlug ? RUBRIC_DISPLAY_NAMES[rubricSlug] : null,
    })
  }, [documentId, reviewData, pageRole, rubricSlug, setScope])

  function handleClose() {
    log('panel_toggle', { action: 'close' })
    closePanel()
  }

  function handleNewChat() {
    clearChat()
    setView('chat')
  }

  function handleOpenHistory() {
    setView('history')
  }

  async function handleSelectSession(sessionId: string) {
    await openHistorySession(sessionId)
    setView('chat')
  }

  function handleBackToCurrent() {
    resumeActiveSession()
    setView('chat')
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
      if (!pageRole || !rubricSlug) {
        addMessage('ai', 'Navigate to a review or feedback page first so I know what rubric to ground my answers in.')
        return
      }

      const contextBlock = hasContext
        ? `\n\nContext from the reviewer:\n${state.contextSnippets.map(s => `"${s.text}"`).join('\n')}`
        : ''
      const fullPrompt = text + contextBlock

      const { callAI } = await import('./shortcuts/aiService')
      const response = await callAI({ mode: 'freeform', userMessage: fullPrompt, pageRole, rubricSlug })
      addMessage('ai', response)
      log('response_received', {
        response_time_ms: Date.now() - startTime,
        trigger: 'freeform',
        context_source: hasContext ? 'selection_popup' : 'no_context',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      addMessage('ai', message)
    }
  }

  async function handleSelectOption(option: ChatOption) {
    const pending = state.pendingFollowUp
    if (!pending || state.isLoading) return

    addMessage('user', option.label)
    setLoading(true)
    setPendingFollowUp(null)
    const startTime = Date.now()

    try {
      const result = await explainCriterionFollowUp({
        criterion: pending.criterion,
        criterionIndex: pending.criterionIndex,
        followUp: option.key as ExplainCriterionFollowUp,
        pageRole: 'reviewer',
        rubricSlug: pending.rubricSlug,
      })
      addMessage('ai', result, undefined, 'explain-criterion')
      log('response_received', { response_time_ms: Date.now() - startTime, trigger: 'shortcut', context_source: 'picker' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      addMessage('ai', message)
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

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-[rgba(196,198,205,0.3)]">
        <span className="text-[13px] font-semibold text-text-primary">AI Assistant</span>
        <div className="flex items-center gap-3">
          {view === 'history' ? (
            <button
              onClick={() => setView('chat')}
              className="text-[12px] text-text-muted hover:text-text-secondary transition-colors duration-[120ms] font-medium"
            >
              Cancel
            </button>
          ) : isViewingHistory ? (
            <button
              onClick={handleBackToCurrent}
              className="text-[12px] text-text-muted hover:text-text-secondary transition-colors duration-[120ms] font-medium"
            >
              Back to current chat
            </button>
          ) : (
            <>
              {hasMessages && (
                <button
                  onClick={handleNewChat}
                  className="text-[12px] text-text-muted hover:text-text-secondary transition-colors duration-[120ms] font-medium"
                >
                  New chat
                </button>
              )}
              <button
                onClick={handleOpenHistory}
                aria-label="View previous conversations"
                className="text-text-muted hover:text-text-primary transition-colors duration-[120ms]"
              >
                <HistoryIcon />
              </button>
            </>
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
        {view === 'history' ? (
          <ChatHistoryList loadSessions={loadHistorySessions} onSelectSession={handleSelectSession} />
        ) : hasMessages ? (
          <ChatMessages messages={state.messages} isLoading={state.isLoading} onSelectOption={handleSelectOption} />
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
      {view === 'chat' && (
        <div className="flex-shrink-0">
          <ShortcutPills shortcuts={shortcuts} isReviewDataLoading={isReviewDataLoading} fetchReviewData={fetchReviewData} />

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
      )}
    </div>
  )
}
