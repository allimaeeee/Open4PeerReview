'use client'

import { useEffect, useRef, useState } from 'react'
import type { Message, ChatOption } from './AIChatContext'
import { AIMascot } from './AIMascot'

interface Props {
  messages: Message[]
  isLoading: boolean
  onSelectOption?: (option: ChatOption) => void
}

export function ChatMessages({ messages, isLoading, onSelectOption }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [mascotState, setMascotState] = useState<'thinking' | 'success' | null>(null)
  const hasBeenLoadingRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (isLoading) {
      hasBeenLoadingRef.current = true
      setMascotState('thinking')
      return
    }
    if (hasBeenLoadingRef.current) {
      hasBeenLoadingRef.current = false
      setMascotState('success')
      const timer = setTimeout(() => setMascotState(null), 800)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (messages.length === 0 && !isLoading) return null

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {messages.map((msg, i) => (
        <div
          key={msg.id}
          className={['flex ai-message-enter', msg.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}
        >
          {msg.role === 'user' ? (
            <div className="max-w-[80%] rounded-md rounded-tr-none bg-[rgba(254,214,91,0.2)] px-3.5 py-2.5">
              <p className="text-[13px] leading-relaxed text-text-primary whitespace-pre-wrap">{msg.text}</p>
            </div>
          ) : (
            <div className="max-w-[88%] flex flex-col gap-2 rounded-md rounded-tl-none bg-surface-container-low px-3.5 py-2.5">
              <p className="text-[13px] leading-relaxed text-text-primary whitespace-pre-wrap">{msg.text}</p>
              {/* Only the most recent AI message's options stay tappable — older ones are stale once the conversation moves on. */}
              {msg.options && msg.options.length > 0 && i === messages.length - 1 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  {msg.options.map(option => (
                    <button
                      key={option.key}
                      onClick={() => onSelectOption?.(option)}
                      disabled={isLoading}
                      className="text-left text-[12px] font-medium text-text-primary bg-surface-card border border-border rounded-md px-2.5 py-1.5 hover:bg-[#edeae2] transition-colors duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {mascotState && (
        <div className="flex justify-start px-1">
          <AIMascot state={mascotState} className="w-10 h-12" />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
