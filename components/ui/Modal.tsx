'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

function cx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

interface ModalContentProps {
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return

    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-primary/40 z-[var(--z-modal)]"
      onClick={onClose}
    >
      {children}
    </div>,
    document.body
  )
}

export function ModalContent({ children, className }: ModalContentProps) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      className={cx(
        'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        'w-full max-w-3xl h-[80vh]',
        'bg-surface-card rounded-lg shadow-4 overflow-hidden',
        'z-[var(--z-modal)]',
        className
      )}
    >
      {children}
    </div>
  )
}
