'use client'

// Listens for text selection on the main document.
// Returns selected text + bounding rect when in scope (not PDF text layer, not form fields).
// Suppressed inside iframes (cross-frame isolation) and PDF.js text layers (.textLayer).

import { useState, useEffect, useCallback } from 'react'

export interface SelectionState {
  text: string
  rect: DOMRect
}

export function useSelectionDetector(): SelectionState | null {
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null)

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectionState(null)
      return
    }

    const text = selection.toString().trim()
    if (!text) {
      setSelectionState(null)
      return
    }

    const anchor = selection.anchorNode?.parentElement

    // Suppress inside PDF.js text layer (pdfjs-dist 5.x uses .textLayer class)
    if (anchor?.closest('.textLayer')) {
      setSelectionState(null)
      return
    }

    // Suppress inside form fields
    if (anchor?.closest('textarea, input')) {
      setSelectionState(null)
      return
    }

    // Suppress inside the OER HTML viewer iframe container
    // (selections inside the iframe document don't propagate to the parent window,
    // so this check is belt-and-suspenders for edge cases like overlays)
    if (anchor?.closest('iframe')) {
      setSelectionState(null)
      return
    }

    try {
      const range = selection.getRangeAt(0)
      const rect  = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        setSelectionState(null)
        return
      }
      setSelectionState({ text, rect })
    } catch {
      setSelectionState(null)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [handleSelectionChange])

  return selectionState
}
