'use client'

import { useEffect, useRef, useState } from 'react'
import type { Message } from './AIChatContext'
import { AIMascot } from './AIMascot'

interface Props {
  messages: Message[]
  isLoading: boolean
}

export function ChatMessages({ messages, isLoading }: Props) {
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
      {messages.map(msg => (
        <div
          key={msg.id}
          className={['flex ai-message-enter', msg.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}
        >
          {msg.role === 'user' ? (
            <div className="max-w-[80%] rounded-md rounded-tr-none bg-[rgba(254,214,91,0.2)] px-3.5 py-2.5">
              <p className="text-[13px] leading-relaxed text-text-primary whitespace-pre-wrap">{msg.text}</p>
            </div>
          ) : (
            <div className="max-w-[88%] rounded-md rounded-tl-none bg-surface-container-low px-3.5 py-2.5">
              <p className="text-[13px] leading-relaxed text-text-primary whitespace-pre-wrap">{msg.text}</p>
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
