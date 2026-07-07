'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AIChatEventType, AIChatEventData } from './types'

export type LogFn = <E extends AIChatEventType>(eventType: E, data: AIChatEventData[E]) => void

const AIChatLoggerContext = createContext<LogFn | null>(null)

export function AIChatLoggerProvider({ children }: { children: ReactNode }) {
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  // All mutable values live in refs so the log() callback stays stable
  const supabaseRef   = useRef(createClient())
  const userIdRef     = useRef<string | null>(null)
  const sessionIdRef  = useRef<string>(crypto.randomUUID())
  const pageRoleRef   = useRef<string | null>(null)
  const documentIdRef = useRef<string | null>(null)
  const pathnameRef   = useRef<string>(pathname)

  // Resolve authenticated user once on mount
  useEffect(() => {
    supabaseRef.current.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null
    })
  }, [])

  // Sync URL-derived context to refs on navigation
  useEffect(() => {
    pathnameRef.current = pathname
    if (pathname === '/review') {
      pageRoleRef.current  = 'reviewer'
      documentIdRef.current = searchParams.get('document')
    } else if (pathname.startsWith('/author/feedback/')) {
      pageRoleRef.current  = 'author'
      const parts = pathname.split('/')
      documentIdRef.current = parts[parts.length - 1] ?? null
    } else {
      pageRoleRef.current  = null
      documentIdRef.current = null
    }
  }, [pathname, searchParams])

  // Stable log function — reads current values from refs, never triggers re-renders
  const log = useCallback<LogFn>((eventType, data) => {
    const userId = userIdRef.current
    if (!userId) return  // not authenticated — skip silently

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabaseRef.current as any)
      .from('ai_chat_events')
      .insert({
        user_id:     userId,
        document_id: documentIdRef.current,
        session_id:  sessionIdRef.current,
        page_role:   pageRoleRef.current,
        page_path:   pathnameRef.current,
        event_type:  eventType,
        event_data:  data,
      })
      .then(({ error }: { error: { message: string } | null }) => {
        if (error && process.env.NODE_ENV === 'development') {
          console.warn('[ai-chat log]', eventType, error.message)
        }
      })
  }, []) // intentionally empty — all values read from refs

  return (
    <AIChatLoggerContext.Provider value={log}>
      {children}
    </AIChatLoggerContext.Provider>
  )
}

export function useAIChatLogger(): LogFn {
  const log = useContext(AIChatLoggerContext)
  if (!log) throw new Error('useAIChatLogger must be used inside AIChatLoggerProvider')
  return log
}
