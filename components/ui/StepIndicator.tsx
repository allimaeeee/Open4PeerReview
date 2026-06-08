'use client'

export interface StepIndicatorProps {
  steps: string[]
  currentStep: number
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className="w-3.5 h-3.5">
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

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
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
                  'w-7 h-7 rounded-full flex items-center justify-center text-label-sm font-label font-bold transition-colors',
                  completed && 'bg-secondary text-white',
                  active    && 'bg-primary text-on-primary',
                  !completed && !active && 'bg-surface-container-high text-text-muted',
                )}
              >
                {completed ? <CheckIcon /> : num}
              </div>
              <span
                className={cx(
                  'text-label-sm font-label uppercase tracking-widest',
                  active ? 'text-primary font-semibold' : 'text-text-muted',
                )}
              >
                {label}
              </span>
            </div>

            {/* Connecting line — rendered between steps only */}
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-border mx-3" />
            )}

          </div>
        )
      })}
    </div>
  )
}

export default StepIndicator
