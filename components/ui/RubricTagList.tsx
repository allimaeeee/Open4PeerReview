import React from 'react'
import { RubricTag } from './RubricTag'

export interface RubricTagListProps {
  rubrics: { rubricId: string; rubricTitle: string }[]
  max?: number
  variant?: 'plain' | 'filled' | 'outlined'
  separator?: boolean
  className?: string
}

export function RubricTagList({ rubrics, max = 3, variant = 'filled', separator = false, className }: RubricTagListProps) {
  const visible = rubrics.slice(0, max)
  const overflow = rubrics.length - visible.length

  const items: React.ReactNode[] = []
  visible.forEach((r, i) => {
    if (separator && i > 0) items.push(<span key={`dot-${i}`} className="text-text-secondary">·</span>)
    items.push(<RubricTag key={r.rubricId} label={r.rubricTitle} variant={variant} />)
  })
  if (overflow > 0) {
    if (separator) items.push(<span key="dot-overflow" className="text-text-secondary">·</span>)
    items.push(<span key="overflow" className="text-body-sm text-text-secondary">+{overflow} more</span>)
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap${className ? ` ${className}` : ''}`}>
      {items}
    </div>
  )
}
