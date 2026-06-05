/**
 * SaveStatusIndicator
 *
 * Displays live auto-save state and a manual "Save Draft" button.
 * Designed to sit in the annotation panel header or review toolbar.
 *
 * Props:
 *   status       — current SaveStatus from useReviewAutoSave
 *   lastSavedAt  — ISO string from reviews.last_saved_at (re-fetch after save)
 *   onSaveDraft  — calls saveDraft() from useReviewAutoSave
 *   disabled     — true when review is submitted (locks everything)
 */

import { useEffect, useState } from 'react'
import type { SaveStatus } from '../hooks/useReviewAutoSave'
import { Button } from '@/components/ui/Button'

interface SaveStatusIndicatorProps {
  status: SaveStatus
  lastSavedAt?: string | null
  onSaveDraft: () => Promise<void>
  disabled?: boolean
}

function formatRelativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 10)  return 'just now'
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function SaveStatusIndicator({
  status,
  lastSavedAt,
  onSaveDraft,
  disabled = false,
}: SaveStatusIndicatorProps) {
  const [saving, setSaving] = useState(false)
  const [relativeTime, setRelativeTime] = useState<string | null>(null)

  // Refresh "X ago" label every 30 s
  useEffect(() => {
    if (!lastSavedAt) return
    const update = () => setRelativeTime(formatRelativeTime(lastSavedAt))
    update()
    const interval = setInterval(update, 30_000)
    return () => clearInterval(interval)
  }, [lastSavedAt])

  const handleSaveDraft = async () => {
    if (saving || disabled) return
    setSaving(true)
    await onSaveDraft()
    setSaving(false)
  }

  // ── Status label ────────────────────────────────────────────────────────────

  const statusConfig = {
    idle: {
      icon: null,
      label: lastSavedAt ? `Saved ${relativeTime}` : null,
      className: 'text-gray-400',
    },
    saving: {
      icon: <SpinnerIcon />,
      label: 'Saving…',
      className: 'text-gray-400',
    },
    saved: {
      icon: <CheckIcon />,
      label: 'Saved',
      className: 'text-emerald-500',
    },
    error: {
      icon: <AlertIcon />,
      label: 'Save failed — try again',
      className: 'text-red-500',
    },
  }[status]

  return (
    <div className="flex items-center gap-3 text-sm select-none">
      {/* Auto-save status */}
      {(statusConfig.icon || statusConfig.label) && (
        <span className={`flex items-center gap-1.5 ${statusConfig.className}`}>
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      )}

      {/* Manual save-draft button */}
      {!disabled && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSaveDraft}
          loading={saving}
          disabled={status === 'saving'}
        >
          {!saving && <SaveIcon />}
          Save Draft
        </Button>
      )}

      {disabled && (
        <span className="flex items-center gap-1.5 text-gray-400">
          <LockIcon />
          Submitted
        </span>
      )}
    </div>
  )
}

// ── Icons (inline SVG, no external dep) ──────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
        clipRule="evenodd" />
    </svg>
  )
}
