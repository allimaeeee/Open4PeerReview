// Domain-specific types not captured by Supabase codegen.
// Database schema types live in @/types/database.types — import Database from there.

export type { Database } from '@/types/database.types'

export type AnchorType = 'text-range' | 'dom-range' | 'bbox' | 'timestamp'

export interface TextRangeAnchor {
  type: 'text-range'
  page: number
  start: number
  end: number
}

export interface DomRangeAnchor {
  type: 'dom-range'
  xpath: string
  startOffset: number
  endOffset: number
}

export interface HtmlCharOffsetAnchor {
  type: 'html-char-offset'
  start: number
  end: number
  text: string
}

export interface BboxAnchor {
  type: 'bbox'
  x: number
  y: number
  width: number
  height: number
}

export interface TimestampAnchor {
  type: 'timestamp'
  startSec: number
  endSec: number
}

/** Stored as JSON in annotations.anchor */
export type Anchor = TextRangeAnchor | DomRangeAnchor | HtmlCharOffsetAnchor | BboxAnchor | TimestampAnchor

/** PDF text-selection anchor shape used by the review UI */
export interface PdfTextAnchor {
  page: number
  text: string
  rects: { x1: number; y1: number; x2: number; y2: number }[]
}
