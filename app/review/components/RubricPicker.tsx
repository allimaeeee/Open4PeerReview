'use client'

// app/reviewer/_components/RubricPicker.tsx

import { useState } from 'react'
import type { OERDocument, RubricPickerItem } from '@/types'

const RUBRIC_ICONS: Record<string, string> = {
  'Accessibility':                    '♿',
  'Copy Editing':                     '✏️',
  'Copyright Review':                 '©️',
  'Disciplinary Appropriateness':     '🎓',
  'eLearning':                        '💻',
  'Universal Design for Learning (UDL)': '🌐',
}

interface RubricPickerProps {
  document: OERDocument
  rubrics: RubricPickerItem[]
  onSelect: (rubric: RubricPickerItem) => Promise<void>
}

export function RubricPicker({ document, rubrics, onSelect }: RubricPickerProps) {
  const [selected, setSelected] = useState<RubricPickerItem | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    if (!selected || loading) return
    setLoading(true)
    await onSelect(selected)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-navy-600 uppercase text-[#1e3a5f] mb-1">
            Open 4 Peer Review
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Reviewing: <span className="text-[#1e3a5f]">{document.title}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Select a rubric to guide your peer review session.
          </p>
        </div>
      </header>

      {/* Rubric grid */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-8 py-10">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">
          Choose a Rubric
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {rubrics.map((rubric) => {
            const isSelected = selected?.id === rubric.id
            const isOpen = expanded === rubric.id

            return (
              <div
                key={rubric.id}
                className={[
                  'rounded-xl border-2 bg-white transition-all duration-150 cursor-pointer',
                  isSelected
                    ? 'border-[#1e3a5f] shadow-md shadow-[#1e3a5f]/10'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
                ].join(' ')}
                onClick={() => setSelected(rubric)}
              >
                {/* Card header */}
                <div className="flex items-start gap-3 p-5">
                  {/* Selection indicator */}
                  <div
                    className={[
                      'mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                      isSelected
                        ? 'border-[#1e3a5f] bg-[#1e3a5f]'
                        : 'border-slate-300',
                    ].join(' ')}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">
                        {RUBRIC_ICONS[rubric.title] ?? '📋'}
                      </span>
                      <h3 className="font-semibold text-slate-900 text-sm leading-tight">
                        {rubric.title}
                      </h3>
                    </div>
                    {rubric.description && (
                      <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {rubric.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Expandable definition */}
                {rubric.operational_definition && (
                  <div className="px-5 pb-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpanded(isOpen ? null : rubric.id)
                      }}
                      className="text-xs text-[#1e3a5f] hover:underline font-medium flex items-center gap-1"
                    >
                      {isOpen ? '▾ Hide definition' : '▸ View definition'}
                    </button>
                    {isOpen && (
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                        {rubric.operational_definition}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Start button */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            {selected
              ? `Ready to review with the ${selected.title} rubric`
              : 'Select a rubric above to continue'}
          </p>
          <button
            onClick={handleStart}
            disabled={!selected || loading}
            className={[
              'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-150',
              selected && !loading
                ? 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm hover:shadow-md active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed',
            ].join(' ')}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Starting…
              </>
            ) : (
              <>
                Start Review
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd" />
                </svg>
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  )
}
