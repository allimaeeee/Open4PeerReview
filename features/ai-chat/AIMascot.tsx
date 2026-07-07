'use client'

export type MascotState = 'idle' | 'thinking' | 'success'

interface Props {
  state: MascotState
  className?: string
}

export function AIMascot({ state, className = 'w-16 h-20' }: Props) {
  const isThinking = state === 'thinking'
  const isSuccess  = state === 'success'

  return (
    <svg
      viewBox="0 0 64 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={isThinking ? { animation: 'ai-mascot-float 1.8s ease-in-out infinite' } : undefined}
    >
      {/* Ghost body: dome top + scalloped bottom */}
      <path
        d="M 8 52 L 8 26 Q 8 4 32 4 Q 56 4 56 26 L 56 52 Q 48 64 40 52 Q 32 64 24 52 Q 16 64 8 52 Z"
        fill="var(--color-secondary-container, #fed65b)"
      />

      {isSuccess ? (
        /* Happy squint: upward arc eyes */
        <>
          <path
            d="M 18 40 Q 22 34 26 40"
            stroke="var(--color-text-primary, #1c1c18)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
          <path
            d="M 38 40 Q 42 34 46 40"
            stroke="var(--color-text-primary, #1c1c18)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
        </>
      ) : (
        /* Idle: open eyes; Thinking: half-closed */
        <>
          <ellipse
            cx="22"
            cy="36"
            rx="4"
            ry={isThinking ? 1.8 : 4.5}
            fill="var(--color-text-primary, #1c1c18)"
            opacity="0.7"
          />
          <ellipse
            cx="42"
            cy="36"
            rx="4"
            ry={isThinking ? 1.8 : 4.5}
            fill="var(--color-text-primary, #1c1c18)"
            opacity="0.7"
          />
        </>
      )}
    </svg>
  )
}
