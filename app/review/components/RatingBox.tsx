'use client'

import { useState, useEffect, useRef } from 'react'
import type { ScoreCommentItem } from './ReviewerConsole'
import { Modal, ModalContent } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'

interface RatingBoxProps {
  variant: 'exceeds' | 'exemplifies' | 'does_not_meet'
  comments?: ScoreCommentItem[]
  onAddComment?: (body: string) => void
  onEditComment?: (commentId: string, body: string) => void
  onDeleteComment?: (commentId: string) => void
  onActivate?: () => void
  onDeactivate?: () => void
  standardText?: string
  criterionLabel?: string
  isActive: boolean
  onToggle?: () => void
}

const LABELS: Record<string, string> = {
  exceeds:       'Exceeds',
  exemplifies:   'Exemplifies',
  does_not_meet: 'Does Not Meet',
}

const LABEL_COLORS: Record<string, string> = {
  exceeds:       'text-secondary',
  exemplifies:   'text-primary',
  does_not_meet: 'text-error',
}

const ACTIVE_BORDERS: Record<string, string> = {
  exceeds:       'border-2 border-secondary',
  exemplifies:   'border-2 border-primary',
  does_not_meet: 'border-2 border-error',
}

const INACTIVE_BORDER = 'border border-border/40'


export function RatingBox({
  variant,
  comments,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onActivate,
  onDeactivate,
  standardText,
  criterionLabel,
  isActive,
  onToggle,
}: RatingBoxProps) {
  const [localText, setLocalText] = useState(comments?.[0]?.body ?? '')
  const [showModal, setShowModal] = useState(false)

  const firstCommentRef = useRef(comments?.[0] ?? null)
  const isActiveRef = useRef(isActive)
  const onAddRef = useRef(onAddComment)
  const onEditRef = useRef(onEditComment)
  const onDeleteRef = useRef(onDeleteComment)
  const onActivateRef = useRef(onActivate)
  const onDeactivateRef = useRef(onDeactivate)

  useEffect(() => { firstCommentRef.current = comments?.[0] ?? null }, [comments])
  useEffect(() => { isActiveRef.current = isActive }, [isActive])
  useEffect(() => { onAddRef.current = onAddComment }, [onAddComment])
  useEffect(() => { onEditRef.current = onEditComment }, [onEditComment])
  useEffect(() => { onDeleteRef.current = onDeleteComment }, [onDeleteComment])
  useEffect(() => { onActivateRef.current = onActivate }, [onActivate])
  useEffect(() => { onDeactivateRef.current = onDeactivate }, [onDeactivate])

  // Badge activation/deactivation — short debounce for snappy visual feedback
  useEffect(() => {
    if (variant === 'exemplifies') return
    const timer = setTimeout(() => {
      if (localText.trim()) {
        onActivateRef.current?.()
      } else if (isActiveRef.current) {
        onDeactivateRef.current?.()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [localText, variant])

  // DB save — longer debounce to avoid excess writes
  useEffect(() => {
    if (variant === 'exemplifies') return
    const timer = setTimeout(() => {
      const trimmed = localText.trim()
      const existing = firstCommentRef.current
      if (!trimmed) {
        if (existing) onDeleteRef.current?.(existing.id)
        return
      }
      if (existing) {
        onEditRef.current?.(existing.id, trimmed)
      } else {
        onAddRef.current?.(trimmed)
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [localText, variant])

  const containerBase = 'flex flex-col gap-2 p-3 rounded-none flex-1 min-w-0 bg-surface-container'
  const borderClass = isActive ? ACTIVE_BORDERS[variant] : INACTIVE_BORDER
  const labelClass = `text-label-sm font-label font-semibold uppercase tracking-wide ${LABEL_COLORS[variant]}`

  if (variant === 'exemplifies') {
    const criterionParts = (criterionLabel ?? '').split(' · ')
    const criterionCode = criterionParts[0] ?? ''
    const criterionName = criterionParts.slice(1).join(' · ')
    const standards = standardText
      ? standardText.split(/(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean)
      : []

    return (
      <>
        <div
          className={[
            containerBase,
            borderClass,
            'cursor-pointer text-left w-full transition-colors',
            !isActive ? 'hover:border-primary hover:bg-surface-container' : '',
          ].join(' ')}
          onClick={onToggle}
        >
          <div className="flex items-center gap-1">
            <span className={labelClass}>{LABELS.exemplifies}</span>
            {standardText && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowModal(true) }}
                className="text-text-secondary/60 hover:text-text-secondary transition-colors"
                aria-label="View full standard"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="8" y1="7.5" x2="8" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="8" cy="4.5" r="1" fill="currentColor" />
                </svg>
              </button>
            )}
          </div>
          <p className={`line-clamp-4 ${standardText ? 'text-body-sm text-text-secondary' : 'text-body-sm text-text-muted'}`}>
            {standardText ? standardText.replace(/\d+\.\s+/g, '') : 'No standard defined'}
          </p>
        </div>

        {showModal && (
          <Modal open={showModal} onClose={() => setShowModal(false)}>
            <ModalContent className="max-w-xl">
              <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-label-sm font-label font-semibold uppercase tracking-wide text-secondary mb-1">
                      {criterionCode}
                    </span>
                    <h2 className="text-title-md font-heading font-semibold text-primary leading-snug">
                      {criterionName}
                    </h2>
                    <p className="text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary mt-2">
                      EXEMPLIFIES ESTABLISHED STANDARDS OF QUALITY — FULL RUBRIC TEXT
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0 mt-0.5"
                    aria-label="Close"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M3 3l10 10M13 3L3 13" />
                    </svg>
                  </button>
                </div>
                <hr className="border-0 border-t-2 border-border/50" />
                {/* Standards list */}
                {standards.length > 0 ? (
                  <div>
                    <div>
                      {standards.map((item, i) => {
                        const m = item.match(/^(\d+)\.\s+([\s\S]+)/)
                        const num = m ? m[1] : String(i + 1)
                        const text = m ? m[2].trim() : item
                        return (
                          <div
                            key={i}
                            className={`flex items-start gap-3 py-3${i < standards.length - 1 ? ' border-b border-border/20' : ''}`}
                          >
                            <div className="w-6 h-6 rounded-full bg-surface-container border border-border/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-label-sm font-label font-semibold text-text-secondary">{num}</span>
                            </div>
                            <p className="flex-1 text-body-md font-body leading-relaxed text-text-primary">{text}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-body-md font-body leading-relaxed text-text-primary">
                    {standardText || 'No standard defined'}
                  </p>
                )}
              </div>
            </ModalContent>
          </Modal>
        )}
      </>
    )
  }

  return (
    <div className={`${containerBase} ${borderClass}`}>
      <span className={labelClass}>{LABELS[variant]}</span>
      <Textarea
        variant={variant === 'exceeds' ? 'exceeds' : 'does-not-meet'}
        placeholder={variant === 'exceeds' ? 'Note what exceeds the standard...' : 'Note what does not meet the standard...'}
        value={localText}
        onChange={e => setLocalText(e.target.value)}
        rows={4}
        className="flex-1 bg-transparent"
      />
    </div>
  )
}

export default RatingBox
