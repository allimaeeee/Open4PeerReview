'use client'

import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu'

const VIEW_LABELS: Record<string, string> = {
  author:      'Author',
  reviewer:    'Reviewer',
  coordinator: 'Coordinator',
}

interface Props {
  currentView: string
  availableViews: string[]
}

export function NavRoleSwitcher({ currentView, availableViews }: Props) {
  const router = useRouter()

  if (availableViews.length < 2) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        {VIEW_LABELS[currentView] ?? currentView}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="right">
        {availableViews.map(view => (
          <DropdownMenuItem
            key={view}
            active={view === currentView}
            onClick={() => router.push(`/${view}`)}
          >
            {VIEW_LABELS[view] ?? view}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NavRoleSwitcher
