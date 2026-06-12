'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'

export type ReviewEventType =
  | 'session_start'
  | 'session_end'
  | 'criterion_focus'
  | 'criterion_blur'
  | 'rubric_section_toggle'
  | 'score_set'
  | 'comment_change'
  | 'score_comment_add'
  | 'score_comment_edit'
  | 'score_comment_delete'
  | 'annotation_started'
  | 'annotation_create'
  | 'annotation_edit'
  | 'annotation_delete'
  | 'annotation_abandoned'
  | 'note_add'
  | 'note_edit'
  | 'note_categorize'
  | 'note_delete'
  | 'pdf_page_change'
  | 'pdf_text_select'
  | 'pdf_scroll'
  | 'html_text_select'
  | 'draft_save'
  | 'submit'

interface EventRecord {
  event_type: string
  data: Json | null
  occurred_at: string
}

interface UseReviewTrackingOptions {
  supabase: SupabaseClient<Database>
  reviewId: string
  reviewerId: string
}

export function useReviewTracking({
  supabase,
  reviewId,
  reviewerId,
}: UseReviewTrackingOptions) {
  const sessionId = useRef<string>(crypto.randomUUID())
  const buffer = useRef<EventRecord[]>([])

  // Keep stable refs so event listeners capture the current values
  const supabaseRef = useRef(supabase)
  const reviewIdRef = useRef(reviewId)
  const reviewerIdRef = useRef(reviewerId)
  useEffect(() => { supabaseRef.current = supabase }, [supabase])
  useEffect(() => { reviewIdRef.current = reviewId }, [reviewId])
  useEffect(() => { reviewerIdRef.current = reviewerId }, [reviewerId])

  const flush = useCallback(async (): Promise<void> => {
    if (buffer.current.length === 0) return
    const events = buffer.current.splice(0)
    await supabaseRef.current.from('review_events').insert(
      events.map((e) => ({
        review_id: reviewIdRef.current,
        reviewer_id: reviewerIdRef.current,
        session_id: sessionId.current,
        event_type: e.event_type,
        data: e.data,
        occurred_at: e.occurred_at,
      }))
    )
  }, [])

  const track = useCallback(
    (eventType: ReviewEventType, data?: Json): void => {
      buffer.current.push({
        event_type: eventType,
        data: data ?? null,
        occurred_at: new Date().toISOString(),
      })
    },
    []
  )

  useEffect(() => {
    track('session_start')
    const timer = setInterval(() => void flush(), 30_000)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        track('session_end', { reason: 'hidden' })
        void flush()
      }
    }
    const onUnload = () => {
      track('session_end', { reason: 'unload' })
      void flush()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onUnload)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onUnload)
      track('session_end', { reason: 'unmount' })
      void flush()
    }
  // flush and track are stable (no deps); run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { track, flush, sessionId: sessionId.current }
}
