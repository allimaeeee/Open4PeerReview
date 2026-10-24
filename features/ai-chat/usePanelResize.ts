'use client'

import { useCallback, useRef, useState } from 'react'

const MIN_WIDTH = 320
const MAX_WIDTH = 600

export function usePanelResize(defaultWidth = 360) {
  const [width, setWidth] = useState(defaultWidth)
  const [isDragging, setIsDragging] = useState(false)
  // Track dragging in a ref so event handlers always see the current value
  const isDraggingRef = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    setIsDragging(true)
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      const maxWidth = Math.min(MAX_WIDTH, window.innerWidth * 0.5)
      const newWidth = Math.max(MIN_WIDTH, Math.min(window.innerWidth - ev.clientX, maxWidth))
      setWidth(newWidth)
      // Keep the CSS custom property in sync so body.ai-panel-open stays correct
      document.documentElement.style.setProperty('--ai-panel-width', `${newWidth}px`)
      // Bypass the body transition during drag with an inline style
      if (document.body.classList.contains('ai-panel-open')) {
        document.body.style.paddingRight = `${newWidth}px`
      }
    }

    const onMouseUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
      document.body.style.userSelect = ''
      // Remove inline override — CSS var (already updated) takes over seamlessly
      document.body.style.paddingRight = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return { width, isDragging, handleMouseDown }
}
