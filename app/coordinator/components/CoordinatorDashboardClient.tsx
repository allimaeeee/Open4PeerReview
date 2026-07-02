'use client'

import { useTransition } from 'react'
import { releaseDocument } from '../actions'

interface Props {
  documentId: string
}

export function ReleaseButton({ documentId }: Props) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => releaseDocument(documentId))}
      disabled={isPending}
      className={[
        'shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors',
        isPending
          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
          : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a] shadow-sm',
      ].join(' ')}
    >
      {isPending ? 'Releasing…' : 'Release for Review'}
    </button>
  )
}
