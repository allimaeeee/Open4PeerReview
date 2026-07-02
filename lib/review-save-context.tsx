'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface ReviewSaveStatusContextValue {
  saveStatus: SaveStatus
  lastSavedAt: Date | null
  setSaveStatus: (s: SaveStatus) => void
  setLastSavedAt: (d: Date | null) => void
}

const ReviewSaveStatusContext = createContext<ReviewSaveStatusContextValue>({
  saveStatus: 'idle',
  lastSavedAt: null,
  setSaveStatus: () => {},
  setLastSavedAt: () => {},
})

export function ReviewSaveStatusProvider({ children }: { children: ReactNode }) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  return (
    <ReviewSaveStatusContext.Provider value={{ saveStatus, lastSavedAt, setSaveStatus, setLastSavedAt }}>
      {children}
    </ReviewSaveStatusContext.Provider>
  )
}

export function useReviewSaveStatus() {
  return useContext(ReviewSaveStatusContext)
}
