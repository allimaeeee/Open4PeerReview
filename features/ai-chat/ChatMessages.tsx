'use client'

import { useEffect, useRef } from 'react'
import type { Message } from './AIChatContext'

interface Props {
  messages: Message[]
  isLoading: boolean
}

function LoadingDots() {
  return (
    <div className="flex gap-1 py-1 px-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-300"
          style={{ animation: `ai-chat-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  )
}

export function ChatMessages({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  if (messages.length === 0 && !isLoading) return null

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={['flex', msg.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}
        >
          {msg.role === 'user' ? (
            <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gray-900 px-3.5 py-2.5">
              <p className="text-[13px] leading-relaxed text-white whitespace-pre-wrap">{msg.text}</p>
            </div>
          ) : (
            <div className="max-w-[88%]">
              <p className="text-[13px] leading-relaxed text-gray-700 whitespace-pre-wrap">{msg.text}</p>
            </div>
          )}
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <LoadingDots />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
