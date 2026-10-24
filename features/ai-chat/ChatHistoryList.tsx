'use client'

import { useEffect, useState } from 'react'
import type { ChatSessionSummary } from './lib/chatHistory'

interface Props {
  loadSessions: () => Promise<ChatSessionSummary[]>
  onSelectSession: (sessionId: string) => void
}

// Matches the `id`s assigned to shortcuts in useChatContext.ts — falls back
// to a humanized version of the id for anything not in this list (e.g. if a
// shortcut is renamed and this map isn't updated in lockstep).
const SHORTCUT_LABELS: Record<string, string> = {
  'review-progress': 'Review Progress',
  'check-all-feedback': 'Check All Feedback',
  'explain-criterion': 'Explain Criterion',
  'refine-feedback': 'Refine My Feedback',
  'check-tone': 'Check My Tone',
  'summarize-feedback': 'Summarize Feedback',
  'clarify-annotation': 'Clarify Annotation',
}

function humanizeShortcutType(id: string): string {
  return SHORTCUT_LABELS[id] ?? id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ChatHistoryList({ loadSessions, onSelectSession }: Props) {
  const [sessions, setSessions] = useState<ChatSessionSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    loadSessions().then(result => { if (!cancelled) setSessions(result) })
    return () => { cancelled = true }
  }, [loadSessions])

  if (sessions === null) {
    return <p className="px-4 py-8 text-center text-[13px] text-text-muted">Loading previous conversations…</p>
  }

  if (sessions.length === 0) {
    return <p className="px-4 py-8 text-center text-[13px] text-text-muted">No previous conversations for this review yet.</p>
  }

  return (
    <div className="flex flex-col px-2 py-2">
      {sessions.map(session => (
        <button
          key={session.id}
          onClick={() => onSelectSession(session.id)}
          className="flex flex-col items-start gap-0.5 text-left px-3 py-2.5 rounded-md hover:bg-surface-container-low transition-colors duration-[120ms]"
        >
          <span className="text-[13px] text-text-primary leading-snug">{session.firstMessagePreview}</span>
          <span className="text-[11px] text-text-muted">
            {relativeTime(session.createdAt)}
            {session.shortcutType && ` · ${humanizeShortcutType(session.shortcutType)}`}
          </span>
        </button>
      ))}
    </div>
  )
}
