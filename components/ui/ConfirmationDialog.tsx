'use client'

import { Modal, ModalContent } from './Modal'
import { Button } from './Button'

interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  confirmLabel: string
  discardLabel: string
  onConfirm: () => void
  onDiscard: () => void
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel,
  discardLabel,
  onConfirm,
  onDiscard,
}: ConfirmationDialogProps) {
  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalContent className="max-w-sm h-auto">
        <div className="p-6">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2 className="font-heading text-title-lg text-text-primary leading-snug">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors duration-150"
              aria-label="Close"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <p className="text-body-md text-text-secondary">
            {message}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 mt-6">
            <Button variant="destructive" size="md" onClick={onDiscard}>
              {discardLabel}
            </Button>
            <Button variant="primary" size="md" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>

        </div>
      </ModalContent>
    </Modal>
  )
}
