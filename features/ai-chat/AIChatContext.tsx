'use client'

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
}

export interface ContextSnippet {
  id: string
  text: string
}

interface State {
  isOpen: boolean
  messages: Message[]
  contextSnippets: ContextSnippet[]
  isLoading: boolean
}

type Action =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'TOGGLE' }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'ADD_SNIPPET'; payload: ContextSnippet }
  | { type: 'REMOVE_SNIPPET'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR' }

// ── Reducer ───────────────────────────────────────────────────────────────────

const initialState: State = {
  isOpen: false,
  messages: [],
  contextSnippets: [],
  isLoading: false,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'OPEN':    return { ...state, isOpen: true }
    case 'CLOSE':   return { ...state, isOpen: false }
    case 'TOGGLE':  return { ...state, isOpen: !state.isOpen }
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload], isLoading: false }
    case 'ADD_SNIPPET':
      return { ...state, contextSnippets: [...state.contextSnippets, action.payload] }
    case 'REMOVE_SNIPPET':
      return { ...state, contextSnippets: state.contextSnippets.filter(s => s.id !== action.payload) }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
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
  addMessage: (role: Message['role'], text: string) => void
  addContextSnippet: (text: string) => void
  removeContextSnippet: (id: string) => void
  setLoading: (loading: boolean) => void
  clearChat: () => void
}

const AIChatCtx = createContext<AIChatContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

let idCounter = 0
function nextId() { return String(++idCounter) }

export function AIChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const openPanel          = useCallback(() => dispatch({ type: 'OPEN' }), [])
  const closePanel         = useCallback(() => dispatch({ type: 'CLOSE' }), [])
  const togglePanel        = useCallback(() => dispatch({ type: 'TOGGLE' }), [])
  const setLoading         = useCallback((l: boolean) => dispatch({ type: 'SET_LOADING', payload: l }), [])
  const clearChat          = useCallback(() => dispatch({ type: 'CLEAR' }), [])
  const removeContextSnippet = useCallback((id: string) => dispatch({ type: 'REMOVE_SNIPPET', payload: id }), [])

  const addMessage = useCallback((role: Message['role'], text: string) => {
    dispatch({ type: 'ADD_MESSAGE', payload: { id: nextId(), role, text } })
  }, [])

  const addContextSnippet = useCallback((text: string) => {
    dispatch({ type: 'ADD_SNIPPET', payload: { id: nextId(), text } })
  }, [])

  return (
    <AIChatCtx.Provider value={{
      state,
      openPanel, closePanel, togglePanel,
      addMessage, addContextSnippet, removeContextSnippet,
      setLoading, clearChat,
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
