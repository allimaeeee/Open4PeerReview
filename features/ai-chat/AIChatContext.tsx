'use client'

import { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createSession, saveMessage, loadSessions, loadMessages, type ChatSessionSummary } from './lib/chatHistory'
import type { RubricCriterion } from './shortcuts/types'
import type { RubricSlug } from './rubric-data/rubricNameMap'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatOption {
  key: string
  label: string
}

export interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  /** Tappable follow-up choices attached to this AI message (e.g. Explain Criterion's follow-ups). */
  options?: ChatOption[]
}

export interface ContextSnippet {
  id: string
  text: string
}

// Context needed to resolve a follow-up option click after the fact — set
// alongside a message that carries `options`, since the shortcut that
// produced those options knows which criterion/rubric they're scoped to.
export interface PendingFollowUp {
  criterion: RubricCriterion
  criterionIndex: number
  rubricSlug: RubricSlug
}

// Set by AIChatPanel (which already resolves this via useChatContext) so the
// persistence layer here doesn't need a third independent copy of the
// pathname/role-derivation logic that logging/AIChatLoggerContext.tsx has.
export interface ChatScope {
  documentId: string | null
  reviewId: string | null
  pageRole: 'reviewer' | 'author' | null
  rubricName: string | null
}

interface State {
  isOpen: boolean
  messages: Message[]
  contextSnippets: ContextSnippet[]
  isLoading: boolean
  pendingFollowUp: PendingFollowUp | null
}

type Action =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE' }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'LOAD_MESSAGES'; payload: Message[] }
  | { type: 'ADD_SNIPPET'; payload: ContextSnippet }
  | { type: 'REMOVE_SNIPPET'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PENDING_FOLLOWUP'; payload: PendingFollowUp | null }
  | { type: 'CLEAR' }

// ── Reducer ───────────────────────────────────────────────────────────────────

const initialState: State = {
  isOpen: false,
  messages: [],
  contextSnippets: [],
  isLoading: false,
  pendingFollowUp: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'OPEN':    return { ...state, isOpen: true }
    case 'CLOSE':   return { ...state, isOpen: false }
    case 'TOGGLE':  return { ...state, isOpen: !state.isOpen }
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload], isLoading: false }
    case 'LOAD_MESSAGES':
      return { ...state, messages: action.payload, isLoading: false, pendingFollowUp: null }
    case 'ADD_SNIPPET':
      return { ...state, contextSnippets: [...state.contextSnippets, action.payload] }
    case 'REMOVE_SNIPPET':
      return { ...state, contextSnippets: state.contextSnippets.filter(s => s.id !== action.payload) }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_PENDING_FOLLOWUP':
      return { ...state, pendingFollowUp: action.payload }
    case 'CLEAR':
      return { ...initialState, isOpen: state.isOpen }
    default:
      return state
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface AIChatContextValue {
  state: State
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  addMessage: (role: Message['role'], text: string, options?: ChatOption[], shortcutType?: string) => void
  addContextSnippet: (text: string) => void
  removeContextSnippet: (id: string) => void
  setLoading: (loading: boolean) => void
  setPendingFollowUp: (pending: PendingFollowUp | null) => void
  clearChat: () => void
  /** Called by AIChatPanel whenever pageRole/documentId/rubric are resolved or change. */
  setScope: (scope: ChatScope) => void
  /** Call before starting any async AI request (freeform send or shortcut run); returns an id to check against later. */
  beginRequest: () => number
  /** Whether `id` (from beginRequest) is still the most recent request — false means a newer one has since started and this response should be discarded. */
  isCurrentRequest: (id: number) => boolean
  isViewingHistory: boolean
  loadHistorySessions: () => Promise<ChatSessionSummary[]>
  /** Stashes the active conversation, loads a past session's messages into view, and points future saves at it. */
  openHistorySession: (sessionId: string) => Promise<void>
  /** Restores whatever conversation was active before openHistorySession was called. */
  resumeActiveSession: () => void
}

const AIChatCtx = createContext<AIChatContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

let idCounter = 0
function nextId() { return String(++idCounter) }

export function AIChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [isViewingHistory, setIsViewingHistory] = useState(false)

  const supabaseRef = useRef(createClient())
  const userIdRef   = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const sessionCreationRef = useRef<Promise<string | null> | null>(null)
  const scopeRef = useRef<ChatScope>({ documentId: null, reviewId: null, pageRole: null, rubricName: null })
  const requestIdRef = useRef(0)
  // Snapshot of the active (non-historical) conversation, taken right before
  // browsing into a past session, so "back to current chat" can restore it
  // without re-fetching.
  const stashRef = useRef<{ sessionId: string | null; messages: Message[] } | null>(null)

  useEffect(() => {
    supabaseRef.current.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null
    })
  }, [])

  const openPanel          = useCallback(() => dispatch({ type: 'OPEN' }), [])
  const closePanel         = useCallback(() => dispatch({ type: 'CLOSE' }), [])
  const togglePanel        = useCallback(() => dispatch({ type: 'TOGGLE' }), [])
  const setLoading         = useCallback((l: boolean) => dispatch({ type: 'SET_LOADING', payload: l }), [])
  const removeContextSnippet = useCallback((id: string) => dispatch({ type: 'REMOVE_SNIPPET', payload: id }), [])
  const setPendingFollowUp = useCallback((pending: PendingFollowUp | null) => dispatch({ type: 'SET_PENDING_FOLLOWUP', payload: pending }), [])
  const beginRequest = useCallback(() => ++requestIdRef.current, [])
  const isCurrentRequest = useCallback((id: number) => id === requestIdRef.current, [])

  const clearChat = useCallback(() => {
    // "New chat" — next message lazily creates a fresh session row.
    sessionIdRef.current = null
    sessionCreationRef.current = null
    stashRef.current = null
    setIsViewingHistory(false)
    dispatch({ type: 'CLEAR' })
  }, [])

  // AIChatPanel calls this whenever pageRole/documentId/rubric resolve or
  // change. The provider can stay mounted across a document switch within the
  // same route (e.g. /review?document=A -> ?document=B), so without this the
  // previous document's messages/session would keep accumulating against the
  // new document. Only resets on an actual A->B change, not the initial
  // null->A resolution on first mount. openHistorySession never trips this,
  // since it only ever loads sessions already scoped to the current document.
  const setScope = useCallback((scope: ChatScope) => {
    const previousDocumentId = scopeRef.current.documentId
    scopeRef.current = scope
    if (previousDocumentId && scope.documentId && scope.documentId !== previousDocumentId) {
      clearChat()
    }
  }, [clearChat])

  // Lazily creates the session row on the first message of a conversation;
  // concurrent calls (e.g. a user message immediately followed by the AI
  // response) share the same in-flight creation promise rather than racing
  // to create two sessions.
  const ensureSessionId = useCallback(async (): Promise<string | null> => {
    if (sessionIdRef.current) return sessionIdRef.current
    if (!userIdRef.current || !scopeRef.current.documentId || !scopeRef.current.pageRole) return null

    if (!sessionCreationRef.current) {
      sessionCreationRef.current = createSession(supabaseRef.current, {
        documentId: scopeRef.current.documentId,
        reviewId: scopeRef.current.reviewId,
        userId: userIdRef.current,
        role: scopeRef.current.pageRole,
        rubricName: scopeRef.current.rubricName,
      })
    }
    const id = await sessionCreationRef.current
    sessionIdRef.current = id
    return id
  }, [])

  const addMessage = useCallback((role: Message['role'], text: string, options?: ChatOption[], shortcutType?: string) => {
    dispatch({ type: 'ADD_MESSAGE', payload: { id: nextId(), role, text, options } })

    // Fire-and-forget persistence — never blocks the UI, and silently no-ops
    // if the user isn't authenticated or scope hasn't resolved yet (same
    // posture as logging/AIChatLoggerContext.tsx). Skipped entirely while
    // browsing a past session in read-only view.
    if (isViewingHistory) return
    ensureSessionId().then(sessionId => {
      if (!sessionId) return
      saveMessage(supabaseRef.current, {
        sessionId,
        role: role === 'ai' ? 'assistant' : 'user',
        content: text,
        shortcutType: shortcutType ?? null,
      })
    })
  }, [ensureSessionId, isViewingHistory])

  const addContextSnippet = useCallback((text: string) => {
    dispatch({ type: 'ADD_SNIPPET', payload: { id: nextId(), text } })
  }, [])

  const loadHistorySessions = useCallback(async (): Promise<ChatSessionSummary[]> => {
    if (!userIdRef.current || !scopeRef.current.documentId) return []
    return loadSessions(supabaseRef.current, scopeRef.current.documentId, userIdRef.current)
  }, [])

  const openHistorySession = useCallback(async (sessionId: string): Promise<void> => {
    if (!stashRef.current) {
      stashRef.current = { sessionId: sessionIdRef.current, messages: state.messages }
    }
    const historical = await loadMessages(supabaseRef.current, sessionId)
    dispatch({
      type: 'LOAD_MESSAGES',
      payload: historical.map(m => ({ id: nextId(), role: m.role === 'assistant' ? 'ai' : 'user', text: m.content })),
    })
    sessionIdRef.current = sessionId
    setIsViewingHistory(true)
  }, [state.messages])

  const resumeActiveSession = useCallback(() => {
    if (!stashRef.current) return
    dispatch({ type: 'LOAD_MESSAGES', payload: stashRef.current.messages })
    sessionIdRef.current = stashRef.current.sessionId
    stashRef.current = null
    setIsViewingHistory(false)
  }, [])

  return (
    <AIChatCtx.Provider value={{
      state,
      openPanel, closePanel, togglePanel,
      addMessage, addContextSnippet, removeContextSnippet,
      setLoading, setPendingFollowUp, clearChat,
      setScope, beginRequest, isCurrentRequest,
      isViewingHistory, loadHistorySessions, openHistorySession, resumeActiveSession,
    }}>
      {children}
    </AIChatCtx.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAIChat() {
  const ctx = useContext(AIChatCtx)
  if (!ctx) throw new Error('useAIChat must be used inside AIChatProvider')
  return ctx
}
