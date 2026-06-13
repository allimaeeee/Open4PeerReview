'use client'

interface AnnotationSummary {
  id: string
  anchor: Record<string, unknown>
  body: string
  tag: string | null
}

interface AnnotationListCardProps {
  annotation: AnnotationSummary
  onGoTo: (annotationId: string) => void
}

const TAG_LABELS: Record<string, string> = {
  action_item: 'Action item',
  quick_fix:   'Quick fix',
}

export function AnnotationListCard({ annotation, onGoTo }: AnnotationListCardProps) {
  const anchorText = (annotation.anchor as any).text as string | undefined ?? null
  const bodyPreview = annotation.body.length > 100
    ? annotation.body.slice(0, 100) + '…'
    : annotation.body
  const textPreview = anchorText
    ? anchorText.length > 60 ? anchorText.slice(0, 60) + '…' : anchorText
    : null

  return (
    <div className="rounded-md border border-border bg-surface-container-low p-3 flex flex-col gap-1.5">
      {annotation.tag && TAG_LABELS[annotation.tag] && (
        <span className="self-start px-2 py-0.5 rounded-full text-label-sm border border-border text-text-secondary bg-surface-container">
          {TAG_LABELS[annotation.tag]}
        </span>
      )}
      <p className="text-body-sm text-text-primary">{bodyPreview}</p>
      {textPreview && (
        <p className="text-body-sm text-text-muted italic">&ldquo;{textPreview}&rdquo;</p>
      )}
      <button
        type="button"
        onClick={() => onGoTo(annotation.id)}
        className="text-body-sm text-primary hover:underline cursor-pointer self-start"
      >
        Go to annotation
      </button>
    </div>
  )
}

export default AnnotationListCard
