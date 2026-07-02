'use client'

import { useState } from 'react'
import { useAIChat } from './AIChatContext'
import type { Shortcut, RunContext } from './useChatContext'
import type { ReviewerData, FeedbackData, CriterionWithScore } from './shortcuts/types'
import { useAIChatLogger } from './logging/AIChatLoggerContext'
import type { ContextSource } from './logging/types'

interface Props {
  shortcuts: Shortcut[]
  reviewData: ReviewerData | FeedbackData | null
}

type PickerState = {
  shortcut: Shortcut
  criteria: CriterionWithScore[]
} | null

export function ShortcutPills({ shortcuts, reviewData }: Props) {
  const { state, addMessage, setLoading, openPanel } = useAIChat()
  const log = useAIChatLogger()
  const [picker, setPicker] = useState<PickerState>(null)
  const [running, setRunning] = useState<string | null>(null)

  if (shortcuts.length === 0) return null

  const ctx: RunContext = {
    contextSnippets: state.contextSnippets,
    reviewData,
  }

  async function handlePillClick(shortcut: Shortcut) {
    if (running) return
    setRunning(shortcut.id)
    openPanel()

    const hasContext = state.contextSnippets.length > 0
    log('shortcut_clicked', { shortcut_id: shortcut.id, has_context: hasContext })

    try {
      const startTime = Date.now()
      const result = await shortcut.run(ctx)

      if (result === 'NEEDS_PICKER') {
        const criteria = reviewData?.criteria ?? []
        if (criteria.length === 0) {
          addMessage('ai', 'No criteria data available to select from.')
          setRunning(null)
          return
        }
        setPicker({ shortcut, criteria })
        setRunning(null)
        return
      }

      addMessage('user', shortcut.label)
      setLoading(true)
      await new Promise(r => setTimeout(r, 300))
      addMessage('ai', result)

      // context_source: snippets bypass picker → 'selection_popup' if present, else 'no_context'
      const contextSource: ContextSource = hasContext ? 'selection_popup' : 'no_context'
      log('response_received', {
        response_time_ms: Date.now() - startTime,
        trigger: 'shortcut',
        context_source: contextSource,
      })
    } catch (err) {
      addMessage('ai', 'Something went wrong. Please try again.')
      console.error('[AI shortcut error]', err)
    } finally {
      setRunning(null)
    }
  }

  async function handlePickerSelect(criterionId: string) {
    if (!picker?.shortcut.runWithPick) return
    const shortcut = picker.shortcut
    const runWithPick = shortcut.runWithPick!
    setPicker(null)
    setRunning(shortcut.id)

    log('picker_used', { shortcut_id: shortcut.id, criterion_id: criterionId })

    try {
      addMessage('user', shortcut.label)
      setLoading(true)
      await new Promise(r => setTimeout(r, 300))
      const startTime = Date.now()
      const result = await runWithPick(ctx, criterionId)
      addMessage('ai', result)

      log('response_received', {
        response_time_ms: Date.now() - startTime,
        trigger: 'shortcut',
        context_source: 'picker',
      })
    } catch (err) {
      addMessage('ai', 'Something went wrong. Please try again.')
      console.error('[AI shortcut picker error]', err)
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="px-4 pb-1">
      {/* Picker mode */}
      {picker && (
        <div className="mb-2 rounded-md border border-border bg-surface-container-low p-3">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
            Select a criterion
          </p>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {picker.criteria.map(c => (
              <button
                key={c.criterion.id}
                onClick={() => handlePickerSelect(c.criterion.id)}
                className="text-left text-[12px] text-text-secondary font-medium px-2.5 py-1.5 rounded-md hover:bg-surface-card hover:text-text-primary transition-all duration-[120ms] truncate"
              >
                {c.criterion.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPicker(null)}
            className="mt-2 text-[11px] text-text-muted hover:text-text-secondary transition-colors duration-[120ms]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Pill row */}
      <div
        className="ai-pills-scroll flex gap-2 overflow-x-auto whitespace-nowrap scroll-smooth pb-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {shortcuts.map(shortcut => (
          <button
            key={shortcut.id}
            onClick={() => handlePillClick(shortcut)}
            disabled={!!running}
            className={[
              'inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-medium transition-all duration-[120ms] flex-shrink-0',
              'active:scale-[0.97]',
              running === shortcut.id
                ? 'bg-[rgba(254,214,91,0.2)] text-text-secondary cursor-wait'
                : 'bg-surface-container-low text-text-muted hover:bg-[#edeae2] hover:text-text-primary cursor-pointer',
              running && running !== shortcut.id ? 'opacity-40' : '',
            ].join(' ')}
          >
            {running === shortcut.id ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-pulse" />
                {shortcut.label}
              </span>
            ) : (
              shortcut.label
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
