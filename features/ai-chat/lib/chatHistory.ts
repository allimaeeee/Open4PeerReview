// Chat history persistence. Accepts a browser Supabase client — never imports
// React, matching the style of shortcuts/reviewDataLoader.ts.
//
// `ai_chat_sessions`/`ai_chat_messages` aren't in the generated
// types/database.types.ts yet (same situation as `ai_chat_events` in
// logging/AIChatLoggerContext.tsx), so calls are cast through `any` until the
// types are regenerated after the migration in
// supabase/migrations/20260706_ai_chat_history.sql is applied.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ChatSessionSummary {
  id: string
  firstMessagePreview: string
  createdAt: string
  shortcutType: string | null
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  shortcutType: string | null
  createdAt: string
}

interface SessionScope {
  documentId: string
  reviewId: string | null
  userId: string
  role: 'reviewer' | 'author'
  rubricName: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export async function createSession(supabase: SupabaseClient, scope: SessionScope): Promise<string | null> {
  const { data, error } = await (supabase as AnySupabase)
    .from('ai_chat_sessions')
    .insert({
      document_id: scope.documentId,
      review_id: scope.reviewId,
      user_id: scope.userId,
      role: scope.role,
      rubric_name: scope.rubricName,
    })
    .select('id')
    .single()

  if (error) {
    if (process.env.NODE_ENV === 'development') console.warn('[chatHistory] createSession failed', error.message)
    return null
  }
  return data.id as string
}

export async function saveMessage(
  supabase: SupabaseClient,
  params: { sessionId: string; role: 'user' | 'assistant'; content: string; shortcutType?: string | null },
): Promise<void> {
  const { error } = await (supabase as AnySupabase).from('ai_chat_messages').insert({
    session_id: params.sessionId,
    role: params.role,
    content: params.content,
    shortcut_type: params.shortcutType ?? null,
  })
  if (error && process.env.NODE_ENV === 'development') {
    console.warn('[chatHistory] saveMessage failed', error.message)
  }

  // Keep the session's updated_at fresh so "most recent first" ordering
  // reflects last activity, not just creation time. Best-effort — a failure
  // here shouldn't block the message from having been saved above.
  await (supabase as AnySupabase)
    .from('ai_chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.sessionId)
}

const MAX_SESSIONS = 20
const PREVIEW_LENGTH = 50

export async function loadSessions(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
): Promise<ChatSessionSummary[]> {
  const { data: sessions, error } = await (supabase as AnySupabase)
    .from('ai_chat_sessions')
    .select('id, created_at, updated_at')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(MAX_SESSIONS)

  if (error || !sessions || sessions.length === 0) {
    if (error && process.env.NODE_ENV === 'development') console.warn('[chatHistory] loadSessions failed', error.message)
    return []
  }

  const sessionIds = sessions.map((s: { id: string }) => s.id)
  const { data: firstMessages } = await (supabase as AnySupabase)
    .from('ai_chat_messages')
    .select('session_id, role, content, shortcut_type, created_at')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true })

  const firstMessageBySession = new Map<string, { content: string; shortcutType: string | null }>()
  for (const m of firstMessages ?? []) {
    if (!firstMessageBySession.has(m.session_id)) {
      firstMessageBySession.set(m.session_id, { content: m.content, shortcutType: m.shortcut_type })
    }
  }

  return sessions.map((s: { id: string; updated_at: string }) => {
    const first = firstMessageBySession.get(s.id)
    const preview = first?.content?.slice(0, PREVIEW_LENGTH) ?? '(empty conversation)'
    return {
      id: s.id,
      firstMessagePreview: first && first.content.length > PREVIEW_LENGTH ? `${preview}…` : preview,
      createdAt: s.updated_at,
      shortcutType: first?.shortcutType ?? null,
    }
  })
}

export async function loadMessages(supabase: SupabaseClient, sessionId: string): Promise<ChatHistoryMessage[]> {
  const { data, error } = await (supabase as AnySupabase)
    .from('ai_chat_messages')
    .select('role, content, shortcut_type, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    if (process.env.NODE_ENV === 'development') console.warn('[chatHistory] loadMessages failed', error.message)
    return []
  }
  return (data ?? []).map((m: { role: 'user' | 'assistant'; content: string; shortcut_type: string | null; created_at: string }) => ({
    role: m.role,
    content: m.content,
    shortcutType: m.shortcut_type,
    createdAt: m.created_at,
  }))
}
