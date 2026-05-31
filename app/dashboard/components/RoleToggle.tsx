'use client'

import { useRouter } from 'next/navigation'

const VIEW_LABELS: Record<string, string> = {
  author: 'Author',
  reviewer: 'Reviewer',
  coordinator: 'Coordinator',
}

interface Props {
  currentView: string
  availableViews: string[]
}

export function RoleToggle({ currentView, availableViews }: Props) {
  const router = useRouter()

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 gap-1">
      {availableViews.map(view => (
        <button
          key={view}
          onClick={() => router.push(`/dashboard?view=${view}`)}
          className={[
            'px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
            currentView === view
              ? 'bg-white text-[#1e3a5f] shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          ].join(' ')}
        >
          {VIEW_LABELS[view] ?? view}
        </button>
      ))}
    </div>
  )
}
