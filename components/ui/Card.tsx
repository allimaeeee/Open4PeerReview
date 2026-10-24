import { type HTMLAttributes } from 'react'

export type CardVariant = 'elevated' | 'outlined'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export function Card({
  variant = 'outlined',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cx(
        'rounded-md bg-surface-card',
        variant === 'elevated' && 'shadow-2',
        variant === 'outlined' && 'border border-border',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default Card
