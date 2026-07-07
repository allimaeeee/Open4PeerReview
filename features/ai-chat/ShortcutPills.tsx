'use client'

import { useState } from 'react'
import { useAIChat } from './AIChatContext'
import { ALL_CRITERIA_PICKER_ID, type Shortcut, type RunContext, type ShortcutResultWithOptions } from './useChatContext'
import type { ReviewerData, FeedbackData, CriterionWithScore } from './shortcuts/types'
import { useAIChatLogger } from './logging/AIChatLoggerContext'
import type { ContextSource } from './logging/types'

interface Props {
  shortcuts: Shortcut[]
  reviewData: ReviewerData | FeedbackData | null
  isReviewDataLoading: boolean
}

type PickerState = {
  shortcut: Shortcut
  criteria: CriterionWithScore[]
} | null

function isResultWithOptions(
  result: string | ShortcutResultWithOptions,
): result is ShortcutResultWithOptions {
  return typeof result !== 'string'
}

export function ShortcutPills({ shortcuts, reviewData, isReviewDataLoading }: Props) {
  const { state, addMessage, setLoading, openPanel, setPendingFollowUp } = useAIChat()
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
    if (isReviewDataLoading) {
      openPanel()
      addMessage('ai', 'Still loading this review — try again in a moment.')
      return
    }
    setRunning(shortcut.id)
    openPanel()

    const hasContext = state.contextSnippets.length > 0
    log('shortcut_clicked', { shortcut_id: shortcut.id, has_context: hasContext })

    try {
      const startTime = Date.now()
      const result = await shortcut.run(ctx)

      if (result === 'NEEDS_PICKER') {
        const criteria = reviewData?.criteria ?? []
        if (criteria.length === 0 && !shortcut.pickerIncludesAllOption) {
          addMessage('ai', 'No criteria data available to select from.')
          setRunning(null)
          return
        }
        setPicker({ shortcut, criteria })
        setRunning(null)
        return
      }

      addMessage('user', shortcut.label, undefined, shortcut.id)
      setLoading(true)
      await new Promise(r => setTimeout(r, 300))
      if (isResultWithOptions(result)) {
        addMessage('ai', result.text, result.options, shortcut.id)
        setPendingFollowUp(result.followUpContext)
      } else {
        addMessage('ai', result, undefined, shortcut.id)
      }

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
    const pickedLabel = criterionId === ALL_CRITERIA_PICKER_ID
      ? 'All criteria'
      : picker.criteria.find(c => c.criterion.id === criterionId)?.criterion.label ?? criterionId
    setPicker(null)
    setRunning(shortcut.id)

    log('picker_used', { shortcut_id: shortcut.id, criterion_id: criterionId })

    try {
      // Show which criterion was picked, not just the shortcut's generic
      // label — otherwise every picker-driven message in history reads
      // identically ("Explain Criterion") with no way to tell which one.
      addMessage('user', `${shortcut.label}: ${pickedLabel}`, undefined, shortcut.id)
      setLoading(true)
      await new Promise(r => setTimeout(r, 300))
      const startTime = Date.now()
      const result = await runWithPick(ctx, criterionId)
      if (isResultWithOptions(result)) {
        addMessage('ai', result.text, result.options, shortcut.id)
        setPendingFollowUp(result.followUpContext)
      } else {
        addMessage('ai', result, undefined, shortcut.id)
      }

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
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {picker.shortcut.pickerIncludesAllOption && (
              <button
                onClick={() => handlePickerSelect(ALL_CRITERIA_PICKER_ID)}
                className="text-left text-[12px] text-text-secondary font-medium px-2.5 py-1.5 rounded-md hover:bg-surface-card hover:text-text-primary transition-all duration-[120ms] leading-snug"
              >
                All criteria
              </button>
            )}
            {picker.criteria.map(c => (
              <button
                key={c.criterion.id}
                onClick={() => handlePickerSelect(c.criterion.id)}
                className="text-left text-[12px] text-text-secondary font-medium px-2.5 py-1.5 rounded-md hover:bg-surface-card hover:text-text-primary transition-all duration-[120ms] leading-snug"
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
              isReviewDataLoading ? 'opacity-60' : '',
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
