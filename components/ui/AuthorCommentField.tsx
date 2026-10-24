'use client'

import { useEffect, useRef, useState } from 'react'

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

interface AuthorCommentFieldProps {
  /** The author's saved comment for this item ('' when none). */
  value: string
  /** Persist the new value. An empty string means "clear". Called on blur when the text changed. */
  onSave: (body: string) => void | Promise<void>
  label?: string
  placeholder?: string
  className?: string
}

const textareaClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-card)] px-3 py-2 text-body-sm text-[var(--color-text-primary)] leading-relaxed resize-y min-h-[60px] focus:outline-none focus:border-[var(--color-border-strong)]'

/**
 * Author-only free-text comment box attached to a single feedback item
 * (an annotation or a rubric criterion). Saves on blur when the text changed;
 * clearing it to empty removes the stored comment. Hidden from print/export,
 * matching the address-status controls it sits alongside.
 */
export function AuthorCommentField({
  value,
  onSave,
  label = 'Your Comment',
  placeholder = 'Add a comment for the reviewer or your own notes…',
  className,
}: AuthorCommentFieldProps) {
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const savedRef = useRef(value)

  // Keep the draft in sync if the saved value changes from outside (e.g. reload).
  useEffect(() => {
    setDraft(value)
    savedRef.current = value
  }, [value])

  const handleBlur = async () => {
    const next = draft.trim()
    if (next === savedRef.current.trim()) return
    setSaving(true)
    try {
      await onSave(next)
      savedRef.current = next
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cx('flex flex-col gap-1.5', className)} data-print-hide>
      <div className="flex items-baseline justify-between gap-2">
        <span className="block text-label-sm font-label font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}
        </span>
        {saving && (
          <span className="text-label-sm font-label text-[var(--color-text-muted)]">Saving…</span>
        )}
      </div>
      <textarea
        className={textareaClass}
        placeholder={placeholder}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  )
}
