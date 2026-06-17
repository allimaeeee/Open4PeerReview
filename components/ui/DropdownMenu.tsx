'use client'

import { createContext, useContext, useRef, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// ── Context ────────────────────────────────────────────────────────────────

interface DropdownContextValue {
  open: boolean
  setOpen: (v: boolean) => void
}

const DropdownContext = createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
})

function useDropdown() {
  return useContext(DropdownContext)
}

// ── Utilities ──────────────────────────────────────────────────────────────

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ── ChevronIcon (internal) ─────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cx(
        'w-4 h-4 flex-shrink-0 transition-transform duration-[var(--transition-duration-base)]',
        open && 'rotate-180',
      )}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── DropdownMenu ───────────────────────────────────────────────────────────

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

// ── DropdownMenuTrigger ────────────────────────────────────────────────────

export function DropdownMenuTrigger({ children, className, showChevron = true }: { children: ReactNode; className?: string; showChevron?: boolean }) {
  const { open, setOpen } = useDropdown()

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-haspopup="true"
      onClick={() => setOpen(!open)}
      className={cx(
        'flex items-center gap-1.5 text-label-sm font-label font-semibold uppercase tracking-wide text-text-secondary hover:text-primary transition-colors',
        className,
      )}
    >
      {children}
      {showChevron && <ChevronIcon open={open} />}
    </button>
  )
}

// ── DropdownMenuContent ────────────────────────────────────────────────────

export function DropdownMenuContent({
  children,
  align = 'right',
  className,
}: {
  children: ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  const { open } = useDropdown()

  if (!open) return null

  return (
    <div
      role="menu"
      className={cx(
        'absolute top-full mt-2 w-48 bg-surface-card rounded-md shadow-3 overflow-hidden z-[var(--z-popover)]',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ── DropdownMenuItem ───────────────────────────────────────────────────────

export function DropdownMenuItem({
  children,
  onClick,
  active = false,
  destructive = false,
  disabled = false,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  destructive?: boolean
  disabled?: boolean
  className?: string
}) {
  const { setOpen } = useDropdown()

  function handleClick() {
    if (disabled) return
    onClick?.()
    setOpen(false)
  }

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      className={cx(
        'w-full text-left px-4 py-3 text-body-sm transition-colors',
        disabled && 'text-text-muted opacity-50 cursor-not-allowed',
        !disabled && active && 'bg-surface-container text-primary font-semibold',
        !disabled && destructive && 'text-error hover:bg-error/10',
        !disabled && !active && !destructive && 'text-text-primary hover:bg-surface-container-low',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ── DropdownMenuSeparator ──────────────────────────────────────────────────

export function DropdownMenuSeparator() {
  return <div role="separator" aria-hidden="true" className="h-px bg-border mx-4 my-1" />
}

export default DropdownMenu
