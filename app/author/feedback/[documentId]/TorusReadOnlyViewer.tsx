'use client'

import { useMemo } from 'react'
import { TorusAnnotationViewer } from '@/app/review/components/TorusAnnotationViewer'

interface AnnotationRow {
  id: string
  rubric_item_id: string | null
  anchor: unknown
  body: string
  tag: string | null
}

interface TorusReadOnlyViewerProps {
  sourceUrl: string | null
  courseAccessCode: string | null
  annotations: AnnotationRow[]
  scrollToAnnotationId?: string | null
  rubricItems: { id: string; label: string }[]
  onBack: () => void
  onViewFullComment?: (rubricItemId: string) => void
  onIndexMapReady?: (map: Map<string, number>) => void
}

export function TorusReadOnlyViewer({
  sourceUrl,
  courseAccessCode,
  annotations,
  scrollToAnnotationId,
  rubricItems,
  onBack,
  onViewFullComment,
  onIndexMapReady,
}: TorusReadOnlyViewerProps) {
  const savedAnnotations = useMemo(() => annotations.map(a => ({
    id: a.id,
    rubricItemId: a.rubric_item_id,
    anchor: (a.anchor as Record<string, unknown>) ?? {},
    body: a.body,
    tag: a.tag,
  })), [annotations])

  return (
    <TorusAnnotationViewer
      sourceUrl={sourceUrl}
      courseAccessCode={courseAccessCode}
      savedAnnotations={savedAnnotations}
      rubricItems={rubricItems}
      onBack={onBack}
      disabled={true}
      scrollToAnnotationId={scrollToAnnotationId}
      onIndexMapReady={onIndexMapReady}
      onAnnotationViewFull={onViewFullComment ? (annotationId) => {
        const ann = annotations.find(a => a.id === annotationId)
        if (ann?.rubric_item_id) onViewFullComment(ann.rubric_item_id)
      } : undefined}
    />
  )
}
