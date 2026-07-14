'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { ReportStatus } from '@/types'

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

type Action = 'publish' | 'revise' | 'private'

interface ReportDecisionBarProps {
  /** Author's current decision on the report. null = all reviews released, awaiting a decision. */
  status: ReportStatus | null
  /** Publish the report (make it publicly accessible). */
  onPublish: () => Promise<void>
  /** Start revising — leave per-criterion comments and mark feedback addressed. */
  onRevise: () => Promise<void>
  /** Keep the report private (moves it to the Completed Submissions tab). */
  onKeepPrivate: () => Promise<void>
  /** Current stored link to the revised OER (shown while revising). */
  revisedLink?: string | null
  /** Save (or clear) the revised-OER link. */
  onSaveRevisedLink?: (link: string) => Promise<void>
  className?: string
}

/** Shown while revising: lets the author submit/update a link to their revised OER. */
function RevisedLinkField({
  initial,
  onSave,
}: {
  initial: string | null
  onSave: (link: string) => Promise<void>
}) {
  const [value, setValue] = useState(initial ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = value.trim()
  const dirty = trimmed !== (initial ?? '').trim()

  const save = async () => {
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setError('Enter a full URL starting with http:// or https://')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSave(trimmed)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the link — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <label className="text-label-sm font-label font-semibold text-[var(--color-text-primary)]">
        Revised OER link
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="url"
          inputMode="url"
          className="flex-1 min-w-[220px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface-card)] px-3 py-2 text-body-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-strong)]"
          placeholder="https://…  link to your revised resource"
          value={value}
          onChange={e => { setValue(e.target.value); setError(null) }}
        />
        <Button variant="secondary" size="sm" onClick={save} loading={busy} disabled={busy || !dirty}>
          Save link
        </Button>
      </div>
      {saved && <p className="text-body-sm text-[var(--color-success)]">Link saved.</p>}
      {error && <p className="text-body-sm text-[var(--color-error)]">{error}</p>}
    </div>
  )
}

/**
 * Author-only decision bar shown above the review report once every rubric has
 * been reviewed and released. The author chooses whether to publish the report,
 * revise it first, or keep it private. Published/private reports can still be
 * revised or (re)published from here.
 */
export function ReportDecisionBar({
  status,
  onPublish,
  onRevise,
  onKeepPrivate,
  revisedLink,
  onSaveRevisedLink,
  className,
}: ReportDecisionBarProps) {
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = (action: Action, fn: () => Promise<void>) => async () => {
    setBusy(action)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.')
    } finally {
      setBusy(null)
    }
  }

  const PublishBtn = (
    <Button variant="primary" size="sm" onClick={run('publish', onPublish)} loading={busy === 'publish'} disabled={busy !== null}>
      Publish now
    </Button>
  )
  const ReviseBtn = (label: string) => (
    <Button variant="secondary" size="sm" onClick={run('revise', onRevise)} loading={busy === 'revise'} disabled={busy !== null}>
      {label}
    </Button>
  )
  const KeepPrivateBtn = (label: string) => (
    <Button variant="secondary" size="sm" onClick={run('private', onKeepPrivate)} loading={busy === 'private'} disabled={busy !== null}>
      {label}
    </Button>
  )

  // ── Published ────────────────────────────────────────────────────────────────
  if (status === 'published') {
    return (
      <div
        className={cx('rounded-lg border border-[var(--color-success)] bg-[var(--color-success-container)] px-5 py-4', className)}
        data-print-hide
      >
        <p className="text-body-sm font-label font-semibold text-[var(--color-success)]">Published</p>
        <p className="mt-0.5 text-body-sm text-[var(--color-text-secondary)]">
          This review report is published. It will appear on the public certification directory once that surface is live.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {ReviseBtn('Revise')}
          {KeepPrivateBtn('Make private')}
        </div>
        {error && <p className="mt-2 text-body-sm text-[var(--color-error)]">{error}</p>}
      </div>
    )
  }

  // ── Copy per state for the neutral bar ───────────────────────────────────────
  const heading =
    status === 'revising' ? 'Revising your report'
    : status === 'private' ? 'This report is private'
    : 'Your review report is ready'

  const description =
    status === 'revising'
      ? 'Address the feedback below — mark each item and add your comments — then publish the report or keep it private.'
    : status === 'private'
      ? 'It lives in your Completed Submissions. You can revise it or publish it whenever you’re ready.'
      : 'Every rubric has been reviewed and released. Choose how to proceed.'

  return (
    <div
      className={cx('rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-container)] px-5 py-4', className)}
      data-print-hide
    >
      <p className="text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {heading}
      </p>
      <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
        {description}
      </p>

      {status === 'revising' && onSaveRevisedLink && (
        <RevisedLinkField initial={revisedLink ?? null} onSave={onSaveRevisedLink} />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {PublishBtn}
        {status === 'private' ? ReviseBtn('Revise') : status !== 'revising' && ReviseBtn('Revise first')}
        {status !== 'private' && KeepPrivateBtn('Keep private')}
      </div>

      {error && <p className="mt-2 text-body-sm text-[var(--color-error)]">{error}</p>}
    </div>
  )
}
