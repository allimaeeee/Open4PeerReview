'use client'

import HtmlViewerCanvas from '@/app/review/components/HtmlViewerCanvas'

interface AnnotationRow {
  id: string
  rubric_item_id: string | null
  anchor: unknown
  body: string
  tag: string | null
}

interface OERPage {
  fingerprint: string | null
  url?: string
}

interface OerReadOnlyViewerProps {
  snapshotSrc: string
  annotations: AnnotationRow[]
  /** Scroll to (and highlight) this annotation — switches pages automatically if needed. */
  scrollToAnnotationId?: string | null
  rubricItems: { id: string; label: string }[]
  onViewFullComment?: (rubricItemId: string) => void
  /** Additional pages for multi-page OpenStax documents — same shape as HtmlViewerCanvas. */
  additionalPages?: OERPage[]
}

export function OerReadOnlyViewer({
  snapshotSrc,
  annotations,
  scrollToAnnotationId,
  rubricItems,
  onViewFullComment,
  additionalPages,
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
      additionalPages={additionalPages}
      savedAnnotations={savedAnnotations}
      rubricItems={rubricItems}
      // Route scrollToAnnotationId through focusAnnotationId so cross-page
      // navigation works — focusAnnotationId switches to the right page first,
      // then scrolls and outlines. scrollToAnnotationId is kept null to avoid
      // double-scroll on same-page annotations.
      focusAnnotationId={scrollToAnnotationId ?? null}
      scrollToAnnotationId={null}
      pendingSelection={null}
      activeItemId={null}
      pulseAnnotationId={null}
      disabled={true}
      showPageNav={true}
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
