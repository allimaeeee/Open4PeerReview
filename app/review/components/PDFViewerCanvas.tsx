'use client'

// Renders the OER PDF (client-only — react-pdf requires browser APIs like DOMMatrix).

import { useState, useRef, useCallback, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import type { HighlightTag } from '@/types'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export interface TextSelection {
  text: string
  page: number
  rects: { x1: number; y1: number; x2: number; y2: number }[]
}

export interface AnnotationConfirmPayload {
  body: string
  rubricItemId: string
  tag: HighlightTag
}

interface TooltipPosition {
  x: number
  y: number
}

const TAG_OPTIONS: { value: HighlightTag; label: string; bg: string; text: string; ring: string }[] = [
  { value: 'general',     label: 'General',     bg: 'bg-slate-100',  text: 'text-slate-600', ring: 'ring-slate-400' },
  { value: 'action_item', label: 'Action Item',  bg: 'bg-orange-50',  text: 'text-orange-700', ring: 'ring-orange-400' },
  { value: 'quick_fix',   label: 'Quick Fix',   bg: 'bg-blue-50',    text: 'text-blue-700',  ring: 'ring-blue-400' },
]

interface PDFViewerCanvasProps {
  fileUrl: string
  rubricItems: { id: string; label: string }[]
  activeItemId: string | null
  pendingSelection: TextSelection | null
  onTextSelected: (selection: TextSelection) => void
  onAnnotationConfirm: (payload: AnnotationConfirmPayload) => Promise<string | null | undefined>
  onPendingSelectionClear: () => void
  disabled: boolean
}

export default function PDFViewerCanvas({
  fileUrl,
  rubricItems,
  activeItemId,
  pendingSelection,
  onTextSelected,
  onAnnotationConfirm,
  onPendingSelectionClear,
  disabled,
}: PDFViewerCanvasProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [annotationBody, setAnnotationBody] = useState('')
  const [selectedCriterionId, setSelectedCriterionId] = useState<string>('')
  const [selectedTag, setSelectedTag] = useState<HighlightTag>('general')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // Reset tooltip state when it opens
  useEffect(() => {
    if (tooltipPos) {
      setAnnotationBody('')
      setSelectedTag('general')
      setSaveError(null)
      setSelectedCriterionId(activeItemId ?? rubricItems[0]?.id ?? '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tooltipPos])

  const handleMouseUp = useCallback(() => {
    if (disabled) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return

    const text = selection.toString().trim()
    const range = selection.getRangeAt(0)
    const rects = Array.from(range.getClientRects()).map((r) => ({
      x1: r.left,
      y1: r.top,
      x2: r.right,
      y2: r.bottom,
    }))

    const lastRect = rects[rects.length - 1]
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    setTooltipPos({
      x: lastRect.x1 - containerRect.left + (lastRect.x2 - lastRect.x1) / 2,
      y: lastRect.y1 - containerRect.top - 8,
    })

    onTextSelected({ text, page: currentPage, rects })
  }, [disabled, currentPage, onTextSelected])

  const handleConfirm = async () => {
    if (!annotationBody.trim() || !selectedCriterionId) return
    setIsSaving(true)
    setSaveError(null)
    const err = await onAnnotationConfirm({
      body: annotationBody.trim(),
      rubricItemId: selectedCriterionId,
      tag: selectedTag,
    })
    setIsSaving(false)
    if (err) {
      setSaveError(err)
      return
    }
    setAnnotationBody('')
    setTooltipPos(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleCancelTooltip = () => {
    onPendingSelectionClear()
    setTooltipPos(null)
    setAnnotationBody('')
    setSaveError(null)
    window.getSelection()?.removeAllRanges()
  }

  const activeItemLabel = rubricItems.find((r) => r.id === activeItemId)?.label ?? null

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd" />
            </svg>
          </button>
          <span className="text-xs text-slate-600 tabular-nums">
            {currentPage} / {numPages || '—'}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <svg className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {activeItemLabel && !disabled && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-[#1e3a5f] animate-pulse" />
            Active: <span className="font-medium text-slate-700">{activeItemLabel}</span>
          </div>
        )}

        {disabled && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd" />
            </svg>
            Review submitted
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative flex justify-center py-6 px-4"
        onMouseUp={handleMouseUp}
      >
        {loadError ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <p className="text-sm text-red-500 font-medium">Failed to load PDF</p>
              <p className="text-xs text-slate-400">{loadError}</p>
            </div>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={(err) => setLoadError(err.message)}
            loading={<PDFLoadingSkeleton />}
          >
            <Page
              pageNumber={currentPage}
              renderTextLayer
              renderAnnotationLayer={false}
              className="shadow-lg rounded"
              width={Math.min(
                (containerRef.current?.clientWidth ?? 800) - 32,
                900
              )}
            />
          </Document>
        )}

        {pendingSelection && tooltipPos && !disabled && (
          <div
            className="absolute z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-80"
            style={{
              left: Math.max(8, Math.min(tooltipPos.x - 160, (containerRef.current?.clientWidth ?? 600) - 328)),
              top: Math.max(8, tooltipPos.y - 200),
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700">Link evidence</p>
              <button
                onClick={handleCancelTooltip}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Highlighted text preview */}
            <p className="text-[11px] text-slate-400 bg-slate-50 rounded px-2 py-1 mb-3 line-clamp-2 italic">
              &ldquo;{pendingSelection.text.slice(0, 80)}{pendingSelection.text.length > 80 ? '…' : ''}&rdquo;
            </p>

            {/* Criterion selector */}
            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Criterion <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedCriterionId}
                onChange={(e) => { setSelectedCriterionId(e.target.value); setSaveError(null) }}
                className="w-full text-xs rounded border border-slate-200 px-2.5 py-1.5
                  focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]
                  text-slate-700 bg-white"
              >
                <option value="" disabled>Select a criterion…</option>
                {rubricItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>

            {/* Tag selector */}
            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Tag
              </label>
              <div className="flex gap-1.5">
                {TAG_OPTIONS.map((opt) => {
                  const isSelected = selectedTag === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedTag(opt.value)}
                      className={[
                        'flex-1 py-1 text-[10px] font-semibold rounded-lg border transition-all duration-100',
                        isSelected
                          ? `${opt.bg} ${opt.text} ring-2 ${opt.ring} border-transparent`
                          : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Evidence comment */}
            <div className="mb-2.5">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Evidence comment <span className="text-red-400">*</span>
              </label>
              <textarea
                autoFocus
                rows={3}
                placeholder="Describe how this passage supports or contradicts the criterion…"
                value={annotationBody}
                onChange={(e) => { setAnnotationBody(e.target.value); setSaveError(null) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleConfirm()
                  if (e.key === 'Escape') handleCancelTooltip()
                }}
                className="w-full text-xs rounded border border-slate-200 px-2.5 py-2 resize-none
                  focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              />
            </div>

            {/* Error */}
            {saveError && (
              <p className="text-[10px] text-red-500 mb-2">{saveError}</p>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400">⌘↵ to save</span>
              <button
                onClick={handleConfirm}
                disabled={!annotationBody.trim() || !selectedCriterionId || isSaving}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-white font-medium
                  disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#162d4a] transition-colors"
              >
                {isSaving ? 'Saving…' : 'Save evidence'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PDFLoadingSkeleton() {
  return (
    <div className="w-[700px] h-[900px] bg-white rounded shadow-lg animate-pulse flex flex-col gap-4 p-10">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="h-3 bg-slate-200 rounded" style={{ width: `${65 + (i % 4) * 8}%` }} />
      ))}
    </div>
  )
}
