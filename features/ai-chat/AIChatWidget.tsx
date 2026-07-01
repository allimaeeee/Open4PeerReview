'use client'

// Root mount point for the AI chatbox feature.
// This is the only thing imported into app/layout.tsx.
// Removing this import + deleting /features/ai-chat/ removes the feature with zero residue.

import { AIChatProvider } from './AIChatContext'
import { AIChatPanel } from './AIChatPanel'
import { SelectionPopup } from './SelectionPopup'

export function AIChatWidget() {
  return (
    <AIChatProvider>
      <AIChatPanel />
      <SelectionPopup />
    </AIChatProvider>
  )
}
