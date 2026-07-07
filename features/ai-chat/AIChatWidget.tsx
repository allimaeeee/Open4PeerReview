'use client'

// Root mount point for the AI chatbox feature.
// This is the only thing imported into app/layout.tsx.
// Removing this import + deleting /features/ai-chat/ removes the feature with zero residue.

import './ai-chat.css'
import { usePathname } from 'next/navigation'
import { AIChatProvider } from './AIChatContext'
import { AIChatPanel } from './AIChatPanel'
import { AIOrbButton } from './AIOrbButton'
import { SelectionPopup } from './SelectionPopup'
import { AIChatLoggerProvider } from './logging/AIChatLoggerContext'

// Same route check useChatContext.ts/AIChatLoggerContext.tsx already use to
// resolve pageRole — gated here too so the whole feature (orb + panel, not
// just the orb) is absent outside the review console and the author feedback
// view, e.g. on the dashboard, task pool, or coordinator/admin pages.
function useIsSupportedRoute(): boolean {
  const pathname = usePathname()
  const isReviewConsole = pathname === '/review' || pathname.startsWith('/review?')
  const isFeedbackPage  = pathname.startsWith('/author/feedback/')
  return isReviewConsole || isFeedbackPage
}

export function AIChatWidget() {
  const isSupportedRoute = useIsSupportedRoute()
  if (!isSupportedRoute) return null

  return (
    <AIChatLoggerProvider>
      <AIChatProvider>
        <AIChatPanel />
        <AIOrbButton />
        <SelectionPopup />
      </AIChatProvider>
    </AIChatLoggerProvider>
  )
}
