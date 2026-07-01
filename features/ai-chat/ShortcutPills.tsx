'use client'

import { useState } from 'react'
import { useAIChat } from './AIChatContext'
import type { Shortcut, RunContext } from './useChatContext'
import type { ReviewerData, FeedbackData, CriterionWithScore } from './shortcuts/types'

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

    try {
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
      // Small tick so loading state renders before the (stub) response
      await new Promise(r => setTimeout(r, 300))
      addMessage('ai', result)
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

    try {
      addMessage('user', shortcut.label)
      setLoading(true)
      await new Promise(r => setTimeout(r, 300))
      const result = await runWithPick(ctx, criterionId)
      addMessage('ai', result)
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
        <div className="mb-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Select a criterion
          </p>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {picker.criteria.map(c => (
              <button
                key={c.criterion.id}
                onClick={() => handlePickerSelect(c.criterion.id)}
                className="text-left text-[12px] text-gray-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all duration-150 truncate"
              >
                {c.criterion.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPicker(null)}
            className="mt-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Pill row */}
      <div
        className="flex gap-2 overflow-x-auto whitespace-nowrap scroll-smooth pb-2"
        style={{ scrollbarWidth: 'none' }}
      >
        <style>{`.ai-chat-pills::-webkit-scrollbar { display: none; }`}</style>
        {shortcuts.map(shortcut => (
          <button
            key={shortcut.id}
            onClick={() => handlePillClick(shortcut)}
            disabled={!!running}
            className={[
              'inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all duration-200 ease-out flex-shrink-0',
              running === shortcut.id
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait'
                : 'bg-gray-50/50 border-gray-200/50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 cursor-pointer',
              running && running !== shortcut.id ? 'opacity-50' : '',
            ].join(' ')}
          >
            {running === shortcut.id ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
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
