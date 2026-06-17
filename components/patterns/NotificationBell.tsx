'use client'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'

interface Notification {
  id: string
  message: string
  read: boolean
  timestamp: string
}

interface Props {
  notifications?: Notification[]
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="w-5 h-5"
    >
      <path
        d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 16a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function NotificationBell({ notifications = [] }: Props) {
  const unreadCount = notifications.filter(n => !n.read).length
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <DropdownMenu>
      <div className="relative">
        <DropdownMenuTrigger showChevron={false}>
          <BellIcon />
        </DropdownMenuTrigger>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-secondary text-on-secondary text-[10px] font-semibold pointer-events-none">
            {badgeLabel}
          </span>
        )}
      </div>
      <DropdownMenuContent align="right" className="w-72">
        {notifications.length === 0 ? (
          <div className="py-6 text-body-sm text-text-muted text-center">
            No notifications.
          </div>
        ) : (
          notifications.map((n, i) => (
            <div key={n.id}>
              <DropdownMenuItem className="flex flex-col items-start gap-0.5">
                <span className={n.read ? 'text-text-muted font-normal' : 'text-text-primary font-medium'}>
                  {n.message}
                </span>
                <span className="text-body-sm text-text-muted">{n.timestamp}</span>
              </DropdownMenuItem>
              {i < notifications.length - 1 && <DropdownMenuSeparator />}
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell
