import { useState, useEffect, useRef, useCallback } from "react"

interface UseDraggableOptions {
  storageKey?: string
  defaultPosition?: { x: number; y: number } | null
}

function getActionBarHeight(): number {
  if (typeof document === "undefined") return 0
  try {
    const val = getComputedStyle(document.documentElement).getPropertyValue("--action-bar-h") || "0"
    return parseInt(val, 10) || 0
  } catch {
    return 0
  }
}

export function useDraggable({ storageKey, defaultPosition = null }: UseDraggableOptions = {}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    if (!storageKey || typeof window === "undefined") return defaultPosition
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const barH = getActionBarHeight()
          const safeBottomMargin = Math.max(24, barH + 16)
          const maxX = Math.max(12, window.innerWidth - 64)
          const maxY = Math.max(12, window.innerHeight - 48 - safeBottomMargin)
          return {
            x: Math.min(Math.max(12, parsed.x), maxX),
            y: Math.min(Math.max(12, parsed.y), maxY),
          }
        }
      }
    } catch {
      // Fallback if storage access is restricted or JSON is corrupted
    }
    return defaultPosition
  })

  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const hasMovedRef = useRef(false)
  const pointerStartRef = useRef({ x: 0, y: 0 })
  const elementStartRef = useRef({ x: 0, y: 0 })

  // Keep within viewport boundaries and above bottom action bar
  useEffect(() => {
    const handleReclamp = () => {
      setPosition((prev) => {
        if (!prev || typeof window === "undefined") return prev
        const barH = getActionBarHeight()
        const safeBottomMargin = Math.max(24, barH + 16)
        const maxX = Math.max(12, window.innerWidth - 64)
        const maxY = Math.max(12, window.innerHeight - 48 - safeBottomMargin)
        const clampedX = Math.min(Math.max(12, prev.x), maxX)
        const clampedY = Math.min(Math.max(12, prev.y), maxY)
        if (clampedX === prev.x && clampedY === prev.y) return prev
        return { x: clampedX, y: clampedY }
      })
    }

    window.addEventListener("resize", handleReclamp)
    // Check reclamp on page/route navigation when action bar might appear/disappear
    const timer = setTimeout(handleReclamp, 100)
    return () => {
      window.removeEventListener("resize", handleReclamp)
      clearTimeout(timer)
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag with main button (left click) or touch
    if (e.button !== 0) return

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()

    isDraggingRef.current = true
    hasMovedRef.current = false
    pointerStartRef.current = { x: e.clientX, y: e.clientY }
    elementStartRef.current = { x: rect.left, y: rect.top }

    // Safely capture pointer if supported
    try {
      target.setPointerCapture?.(e.pointerId)
    } catch {
      // Ignore if unsupported in environment
    }

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return
      const dx = ev.clientX - pointerStartRef.current.x
      const dy = ev.clientY - pointerStartRef.current.y

      if (!hasMovedRef.current && Math.hypot(dx, dy) > 5) {
        hasMovedRef.current = true
        setIsDragging(true)
      }

      if (hasMovedRef.current && typeof window !== "undefined") {
        const width = rect.width || 48
        const height = rect.height || 48
        const barH = getActionBarHeight()
        const safeBottomMargin = Math.max(24, barH + 16)
        const maxX = Math.max(12, window.innerWidth - width - 12)
        const maxY = Math.max(12, window.innerHeight - height - safeBottomMargin)
        const newX = Math.min(Math.max(12, elementStartRef.current.x + dx), maxX)
        const newY = Math.min(Math.max(12, elementStartRef.current.y + dy), maxY)
        setPosition({ x: newX, y: newY })
      }
    }

    const onPointerUp = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)

      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerUp)

      try {
        target.releasePointerCapture?.(e.pointerId)
      } catch {
        // Ignore
      }

      if (hasMovedRef.current && typeof window !== "undefined") {
        const width = rect.width || 48
        const height = rect.height || 48
        const barH = getActionBarHeight()
        const safeBottomMargin = Math.max(24, barH + 16)
        const dx = ev.clientX - pointerStartRef.current.x
        const dy = ev.clientY - pointerStartRef.current.y
        const maxX = Math.max(12, window.innerWidth - width - 12)
        const maxY = Math.max(12, window.innerHeight - height - safeBottomMargin)
        const finalX = Math.min(Math.max(12, elementStartRef.current.x + dx), maxX)
        const finalY = Math.min(Math.max(12, elementStartRef.current.y + dy), maxY)
        const finalPos = { x: Math.round(finalX), y: Math.round(finalY) }
        setPosition(finalPos)

        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(finalPos))
          } catch {
            // Ignore storage quota or permission errors
          }
        }
      }
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerUp)
  }, [storageKey])

  const resetPosition = useCallback(() => {
    setPosition(null)
    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // Ignore
      }
    }
  }, [storageKey])

  return {
    position,
    isDragging,
    hasMovedRef,
    onPointerDown,
    resetPosition,
  }
}
