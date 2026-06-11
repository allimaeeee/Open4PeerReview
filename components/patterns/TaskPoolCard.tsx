'use client'

import { useState } from 'react'
import { Accordion } from '@/components/ui/Accordion'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { RubricTag } from '@/components/ui/RubricTag'

export interface TaskPoolCardProps {
  id: string
  title: string
  platform: string
  resourceUrl: string
  authorName: string
  discipline: string
  ccLicense: string
  description: string
  submittedAt: string
  rubrics: { rubricId: string; rubricTitle: string }[]
  onAccept?: (id: string) => void
  onDecline?: (id: string, reason: string, note: string) => void
}

const DECLINE_REASONS = [
  { value: 'outside-expertise',    label: 'Outside my area of expertise' },
  { value: 'conflict-of-interest', label: 'Conflict of interest' },
  { value: 'insufficient-capacity', label: 'Insufficient capacity at this time' },
  { value: 'duplicate-assignment', label: 'Duplicate assignment' },
  { value: 'other',                label: 'Other' },
]

export function TaskPoolCard({
  id,
  title,
  platform,
  resourceUrl,
  authorName,
  discipline,
  ccLicense,
  description,
  submittedAt,
  rubrics,
  onAccept,
  onDecline,
}: TaskPoolCardProps) {
  const [declineMode, setDeclineMode] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [declineNote, setDeclineNote] = useState('')

  const formattedDate = new Date(submittedAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const trigger = (
    <div className="flex items-start w-full">

      {/* Left column (full width — no right column) */}
      <div className="flex-1 min-w-0">

        {/* Row 1: rubric name chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {rubrics.map(r => (
            <RubricTag key={r.rubricId} label={r.rubricTitle} variant="filled" />
          ))}
        </div>

        {/* Row 2: title */}
        <h2 className="font-heading text-title-lg text-text-primary leading-snug mt-2 truncate">
          {title}
        </h2>

        {/* Row 3: metadata */}
        <div className="flex items-center gap-4 mt-1 text-body-sm text-text-secondary flex-wrap">
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 7a3 3 0 100-6 3 3 0 000 6zM2 14a6 6 0 0112 0" />
            </svg>
            {authorName}
          </span>
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 010 1.414l-4.586 4.586a1 1 0 01-1.414 0L3 8.414A2 2 0 012 7V4z" />
              <circle cx="5.5" cy="5.5" r="0.75" fill="currentColor" />
            </svg>
            {discipline}
          </span>
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 2h5v5M14 2L7 9" />
            </svg>
            {platform}
          </span>
          <span>Submitted: {formattedDate}</span>
        </div>

      </div>

    </div>
  )

  return (
    <Accordion trigger={trigger}>

      {/* Section 1 — Metadata + description */}
      <div>
        <div className="flex items-center gap-4 flex-wrap text-body-sm text-text-secondary">

          <span className="flex items-center gap-1">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M9.5 6.5a2 2 0 100 3" />
            </svg>
            {ccLicense}
          </span>

          <a
            href={resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3M9 2h5v5M14 2L7 9" />
            </svg>
            View Resource
          </a>

        </div>

        <p className="mt-3 text-body-sm text-text-secondary">
          {description}
        </p>
      </div>

      {/* Section 2 — Accept / Decline actions */}
      <div className="border-t border-[var(--color-border)] mt-4 pt-4">
        {!declineMode ? (
          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={() => onAccept?.(id)}>
              Accept
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDeclineMode(true)}>
              Decline
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Select
              label="Reason for declining"
              value={declineReason}
              onChange={(e) => {
                setDeclineReason(e.target.value)
                setDeclineNote('')
              }}
            >
              <option value="" disabled>Select a reason…</option>
              {DECLINE_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
            {declineReason === 'other' && (
              <Input
                label="Additional notes"
                placeholder="Please describe your reason..."
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
              />
            )}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onDecline?.(id, declineReason, declineNote)
                  setDeclineMode(false)
                }}
                disabled={!declineReason}
              >
                Confirm Decline
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDeclineMode(false)
                  setDeclineReason('')
                  setDeclineNote('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

    </Accordion>
  )
}
