'use client'

// Root mount point for the AI chatbox feature.
// This is the only thing imported into app/layout.tsx.
// Removing this import + deleting /features/ai-chat/ removes the feature with zero residue.

import './ai-chat.css'
import { AIChatProvider } from './AIChatContext'
import { AIChatPanel } from './AIChatPanel'
import { SelectionPopup } from './SelectionPopup'
import { AIChatLoggerProvider } from './logging/AIChatLoggerContext'

export function AIChatWidget() {
  return (
    <AIChatLoggerProvider>
      <AIChatProvider>
        <AIChatPanel />
        <SelectionPopup />
      </AIChatProvider>
    </AIChatLoggerProvider>
  )
}
