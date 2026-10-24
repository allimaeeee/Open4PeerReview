export interface PdfRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface Anchor {
  pageWidth?: number
  containerWidth?: number
}

/**
 * Rescales a stored PDF annotation rect from the coordinate space it was
 * captured in to the current render space.
 *
 * Rects are stored in container-relative pixel coordinates alongside the
 * pageWidth and containerWidth at capture time. When either the container
 * resizes or the user zooms, we need to remap them to the new render space.
 *
 * Coordinate model:
 *   - The page is horizontally centered inside the container with 16px inset
 *     on each side (px-4). Any remaining space is split evenly.
 *   - Vertically the page starts at py-6 = 24px from the top of the scroll area.
 */
export function scaleRect(
  rect: PdfRect,
  anchor: Anchor,
  currentPageWidth: number,
  currentContainerWidth: number,
): PdfRect {
  const storedPW = anchor?.pageWidth
  const storedCW = anchor?.containerWidth
  if (!storedPW || !storedCW) return rect

  const storedOffsetX = 16 + Math.max(0, (storedCW - 32 - storedPW) / 2)
  const scale = currentPageWidth / storedPW
  const newOffsetX = 16 + Math.max(0, (currentContainerWidth - 32 - currentPageWidth) / 2)

  return {
    x1: newOffsetX + (rect.x1 - storedOffsetX) * scale,
    y1: 24 + (rect.y1 - 24) * scale,
    x2: newOffsetX + (rect.x2 - storedOffsetX) * scale,
    y2: 24 + (rect.y2 - 24) * scale,
  }
}

/** Inverse of scaleRect: maps current-space coordinates back to stored space. */
export function unscalePoint(
  x: number,
  y: number,
  anchor: Anchor,
  currentPageWidth: number,
  currentContainerWidth: number,
): { x: number; y: number } {
  const storedPW = anchor?.pageWidth
  const storedCW = anchor?.containerWidth
  if (!storedPW || !storedCW) return { x, y }

  const storedOffsetX = 16 + Math.max(0, (storedCW - 32 - storedPW) / 2)
  const scale = currentPageWidth / storedPW
  const newOffsetX = 16 + Math.max(0, (currentContainerWidth - 32 - currentPageWidth) / 2)

  return {
    x: storedOffsetX + (x - newOffsetX) / scale,
    y: 24 + (y - 24) / scale,
  }
}

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
export const DEFAULT_ZOOM = 1
