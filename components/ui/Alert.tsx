import { type HTMLAttributes } from 'react'

export type AlertVariant = 'error' | 'success' | 'info'

export interface AlertProps extends HTMLAttributes<HTMLParagraphElement> {
  variant: AlertVariant
  message: string
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function Alert({ variant, message, className, role = 'alert', ...props }: AlertProps) {
  return (
    <p
      role={role}
      className={cx(
        'text-body-sm',
        variant === 'error'   && 'text-error',
        variant === 'success' && 'text-success',
        variant === 'info'    && 'text-info',
        className,
      )}
      {...props}
    >
      {message}
    </p>
  )
}

export default Alert
