import type { ReactNode } from 'react'

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

interface DashboardShellProps {
  sidebar: ReactNode
  children: ReactNode
  rightPanel?: ReactNode
  className?: string
}

export function DashboardShell({ sidebar, children, rightPanel, className }: DashboardShellProps) {
  return (
    <div className={cx('flex min-h-screen w-full', className)}>
      <aside className="w-60 shrink-0 bg-[var(--color-surface-container)]">
        {sidebar}
      </aside>
      <main className="flex-1 min-w-0">
        {children}
      </main>
      {rightPanel && (
        <aside className="w-70 shrink-0">
          {rightPanel}
        </aside>
      )}
    </div>
  )
}
