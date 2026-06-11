'use client'

export interface StepIndicatorProps {
  steps: string[]
  currentStep: number
  size?: 'default' | 'compact' | 'compact-labeled'
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

function CheckIcon({ compact }: { compact?: boolean }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className={compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}>
      <path
        d="M1.5 6L4.5 9.5L10.5 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function StepIndicator({ steps, currentStep, size = 'default' }: StepIndicatorProps) {
  const compact = size === 'compact'
  const compactLabeled = size === 'compact-labeled'

  if (compactLabeled) {
    return (
      <div className="flex flex-col">
        {/* Row 1 — circles + connectors */}
        <div className="flex items-center gap-0">
          {steps.map((label, i) => {
            const num = i + 1
            const completed = currentStep > num
            const active = currentStep === num
            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div
                  className={cx(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-label font-bold transition-colors',
                    completed && 'bg-secondary text-white',
                    active    && 'bg-primary text-on-primary',
                    !completed && !active && 'bg-surface-container-high text-text-muted',
                  )}
                >
                  {completed ? <CheckIcon compact /> : num}
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-px bg-[var(--color-border)] mx-2" />
                )}
              </div>
            )
          })}
        </div>
        {/* Row 2 — labels aligned below circles */}
        <div className="flex items-start mt-1.5">
          {steps.map((label, i) => (
            <div key={label} className="flex-1 last:flex-none flex justify-center">
              <span
                className="text-[9px] font-label uppercase tracking-wide leading-tight text-center"
                style={{ color: currentStep > i + 1 || currentStep === i + 1 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const num = i + 1
        const completed = currentStep > num
        const active = currentStep === num

        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">

            {/* Circle + label pair */}
            <div className="flex items-center gap-2">
              <div
                className={cx(
                  'rounded-full flex items-center justify-center font-label font-bold transition-colors',
                  compact ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-label-sm',
                  completed && 'bg-secondary text-white',
                  active    && 'bg-primary text-on-primary',
                  !completed && !active && 'bg-surface-container-high text-text-muted',
                )}
              >
                {completed ? <CheckIcon compact={compact} /> : num}
              </div>
              {!compact && (
                <span
                  className={cx(
                    'text-label-sm font-label uppercase tracking-widest',
                    active ? 'text-primary font-semibold' : 'text-text-muted',
                  )}
                >
                  {label}
                </span>
              )}
            </div>

            {/* Connecting line — rendered between steps only */}
            {i < steps.length - 1 && (
              <div className={cx('flex-1 h-px bg-border', compact ? 'mx-2' : 'mx-3')} />
            )}

          </div>
        )
      })}
    </div>
  )
}

export default StepIndicator
