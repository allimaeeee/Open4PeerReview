'use client'

import type { ChangeEventHandler } from 'react'

export interface RadioProps {
  checked: boolean
  onChange: ChangeEventHandler<HTMLInputElement>
  disabled?: boolean
  id?: string
  name?: string
  'aria-label'?: string
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function Radio({
  checked,
  onChange,
  disabled,
  id,
  name,
  'aria-label': ariaLabel,
}: RadioProps) {
  return (
    <span className={cx(
      'inline-flex items-center justify-center',
      disabled && 'opacity-40 cursor-not-allowed',
    )}>
      <input
        type="radio"
        id={id}
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className="sr-only peer"
      />
      <span
        aria-hidden="true"
        className={cx(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2',
          checked
            ? 'border-primary bg-primary'
            : 'border-border bg-surface-card',
        )}
      >
        {checked && <span className="w-2 h-2 rounded-full bg-white" />}
      </span>
    </span>
  )
}

export default Radio
