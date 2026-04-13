// lib/supabase/useRealtimeComments.ts
// Client Component hook — subscribes to live comments for a document.
// Drop into any Client Component in the review view.

'use client'

import { useEffect, useState } from 'react'
import { createClient } from './client'
import type { CommentWithAuthor } from './types'

export function useRealtimeComments(
  documentId: string,
  initialComments: CommentWithAuthor[] = []
) {
  const [comments, setComments] = useState<CommentWithAuthor[]>(initialComments)
  const supabase = createClient()

  useEffect(() => {
    // Reset when document changes
    setComments(initialComments)

    const channel = supabase
      .channel(`comments:${documentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `document_id=eq.${documentId}`,
        },
        async (payload) => {
          // Fetch the full comment with author info
          const { data } = await supabase
            .from('comments')
            .select('*, users(display_name, email)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setComments((prev) => [...prev, data as CommentWithAuthor])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `document_id=eq.${documentId}`,
        },
        (payload) => {
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [documentId]) // eslint-disable-line react-hooks/exhaustive-deps

  return comments
}
