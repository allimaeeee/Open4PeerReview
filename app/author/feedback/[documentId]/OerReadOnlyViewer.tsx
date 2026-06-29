'use client'

import HtmlViewerCanvas from '@/app/review/components/HtmlViewerCanvas'

interface AnnotationRow {
  id: string
  rubric_item_id: string | null
  anchor: unknown
  body: string
  tag: string | null
}

interface OerReadOnlyViewerProps {
  snapshotSrc: string
  annotations: AnnotationRow[]
  scrollToAnnotationId?: string | null
  rubricItems: { id: string; label: string }[]
  onViewFullComment?: (rubricItemId: string) => void
}

export function OerReadOnlyViewer({
  snapshotSrc,
  annotations,
  scrollToAnnotationId,
  rubricItems,
  onViewFullComment,
}: OerReadOnlyViewerProps) {
  const savedAnnotations = annotations.map(a => ({
    id: a.id,
    rubricItemId: a.rubric_item_id,
    anchor: (a.anchor as Record<string, unknown>) ?? {},
    body: a.body,
    tag: a.tag,
  }))

  return (
    <HtmlViewerCanvas
      snapshotSrc={snapshotSrc}
      savedAnnotations={savedAnnotations}
      rubricItems={rubricItems}
      scrollToAnnotationId={scrollToAnnotationId ?? null}
      focusAnnotationId={null}
      pendingSelection={null}
      activeItemId={null}
      pulseAnnotationId={null}
      disabled={true}
      onTextSelected={() => {}}
      onAnnotationConfirm={async () => null}
      onPendingSelectionClear={() => {}}
      onAnnotationEdit={async () => {}}
      onAnnotationDelete={async () => {}}
      onTrackEvent={() => {}}
      onGoToAnnotation={() => {}}
      onAnnotationViewFull={onViewFullComment ? (annotationId) => {
        const ann = annotations.find(a => a.id === annotationId)
        if (ann?.rubric_item_id) onViewFullComment(ann.rubric_item_id)
      } : undefined}
    />
  )
}
