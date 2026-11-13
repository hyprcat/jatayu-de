import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useCanvasStore, useUIStore, useSettingsStore } from '../../stores'
import { createNode } from '../chrome/AddElementsDropdown'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface LassoRect {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface InfiniteCanvasProps {
  children?: ReactNode
}

export function InfiniteCanvas({ children }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [lasso, setLasso] = useState<LassoRect | null>(null)
  const transformRef = useRef<HTMLDivElement>(null)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const zoom = useCanvasStore((s) => s.zoom)
  const panOffset = useCanvasStore((s) => s.panOffset)
  const dotGridVisible = useSettingsStore((s) => s.dotGridVisible)

  // Wheel handler: zoom (ctrl/pinch) or pan (two-finger scroll)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { zoom: z, panOffset: pan, setZoom, setPanOffset } = useCanvasStore.getState()

      if (e.ctrlKey || e.metaKey) {
        // Zoom toward cursor position
        const rect = el.getBoundingClientRect()
        const cx = e.clientX - rect.left
        const cy = e.clientY - rect.top
        const wx = (cx - pan.x) / z
        const wy = (cy - pan.y) / z
        const newZoom = clamp(z * (1 - e.deltaY * 0.005), 0.25, 2)
        setZoom(newZoom)
        setPanOffset({ x: cx - wx * newZoom, y: cy - wy * newZoom })
      } else {
        // Pan via two-finger trackpad scroll
        setPanOffset({ x: pan.x - e.deltaX, y: pan.y - e.deltaY })
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // Track Space key for space+drag panning
  useEffect(() => {
    const isInteractive = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false
      const tag = target.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isInteractive(e.target)) {
        e.preventDefault()
        setSpaceDown(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Start panning on middle-click or space+left-click; lasso select on plain left-click on empty canvas
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && spaceDown)) {
        e.preventDefault()
        const { panOffset: pan } = useCanvasStore.getState()
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: pan.x,
          panY: pan.y,
        }
        setIsPanning(true)
      } else if (e.button === 0 && !spaceDown && (e.target === e.currentTarget || e.target === transformRef.current)) {
        // Plain left-click on empty canvas background — start lasso or clear selection
        if (!e.metaKey && !e.ctrlKey) {
          // Clear selection + focused node when clicking empty canvas
          useCanvasStore.getState().clearSelection()
          useUIStore.getState().setFocusedNodeId(null)
        }
        // Start lasso
        setLasso({
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
        })
      }
    },
    [spaceDown],
  )

  // Panning mouse move/up
  useEffect(() => {
    if (!isPanning) return

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      useCanvasStore.getState().setPanOffset({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      })
    }
    const onUp = () => setIsPanning(false)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isPanning])

  // Lasso selection: mouse move + up handlers
  useEffect(() => {
    if (!lasso) return

    const onMove = (e: MouseEvent) => {
      setLasso((prev) => (prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null))
    }

    const onUp = (e: MouseEvent) => {
      if (!lasso) {
        setLasso(null)
        return
      }
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) {
        setLasso(null)
        return
      }
      const { zoom: z, panOffset: pan, nodes, setSelectedIds, selectedIds } = useCanvasStore.getState()

      // Convert lasso screen rect to world coords
      const lx = Math.min(lasso.startX, e.clientX) - rect.left
      const ly = Math.min(lasso.startY, e.clientY) - rect.top
      const lw = Math.abs(e.clientX - lasso.startX)
      const lh = Math.abs(e.clientY - lasso.startY)

      // Only count as a lasso if dragged more than 5px
      if (lw > 5 || lh > 5) {
        const worldLx = (lx - pan.x) / z
        const worldLy = (ly - pan.y) / z
        const worldLw = lw / z
        const worldLh = lh / z

        const newSelection = new Set(e.metaKey || e.ctrlKey ? selectedIds : new Set<string>())
        for (const node of nodes) {
          // AABB intersection test
          if (
            node.position.x < worldLx + worldLw &&
            node.position.x + node.size.w > worldLx &&
            node.position.y < worldLy + worldLh &&
            node.position.y + node.size.h > worldLy
          ) {
            newSelection.add(node.id)
          }
        }
        setSelectedIds(newSelection)
      }

      setLasso(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [lasso])

  // Compute lasso rect for rendering
  const lassoStyle: React.CSSProperties | null =
    lasso && Math.abs(lasso.currentX - lasso.startX) + Math.abs(lasso.currentY - lasso.startY) > 5
      ? {
          position: 'absolute',
          left: Math.min(lasso.startX, lasso.currentX) - (containerRef.current?.getBoundingClientRect().left ?? 0),
          top: Math.min(lasso.startY, lasso.currentY) - (containerRef.current?.getBoundingClientRect().top ?? 0),
          width: Math.abs(lasso.currentX - lasso.startX),
          height: Math.abs(lasso.currentY - lasso.startY),
          border: '1px dashed var(--glass-border)',
          background: 'rgba(255, 255, 255, 0.03)',
          pointerEvents: 'none' as const,
          zIndex: 999,
        }
      : null

  // Dot grid styling — fades out below 50% zoom
  const gridSize = 24 * zoom
  const bgPosX = panOffset.x % gridSize
  const bgPosY = panOffset.y % gridSize
  const dotOpacity = dotGridVisible ? (zoom < 0.5 ? 0 : zoom < 0.65 ? (zoom - 0.5) / 0.15 : 1) : 0

  const isDraggingFile = useUIStore((s) => s.isDraggingFile)
  const cursor = isDraggingFile ? 'copy' : isPanning ? 'grabbing' : spaceDown ? 'grab' : 'default'

  // Drag-and-drop: create file node from file explorer drag
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-flow-file')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    const flowData = e.dataTransfer.getData('application/x-flow-file')
    if (!flowData) return
    e.preventDefault()
    try {
      const { path: filePath, name } = JSON.parse(flowData) as { path: string; name: string }
      const { zoom: z, panOffset: pan } = useCanvasStore.getState()
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const worldX = (e.clientX - rect.left - pan.x) / z
      const worldY = (e.clientY - rect.top - pan.y) / z
      createNode('file', { filePath, title: name, positionOverride: { x: worldX, y: worldY } })
    } catch {
      // Invalid data
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'var(--bg-canvas)',
        overflow: 'hidden',
        cursor,
      }}
      onMouseDown={handleMouseDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Dot grid layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, var(--bg-canvas-dot) 1px, transparent 1px)',
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${bgPosX}px ${bgPosY}px`,
          opacity: dotOpacity,
          transition: 'opacity 300ms',
          pointerEvents: 'none',
        }}
      />

      {/* Transform container for nodes */}
      <div
        ref={transformRef}
        style={{
          transformOrigin: '0 0',
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          willChange: 'transform',
        }}
      >
        {children}
      </div>

      {/* Lasso selection rect */}
      {lassoStyle && <div style={lassoStyle} />}

      {/* Zoom percentage badge */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          padding: '2px 8px',
          borderRadius: 6,
          background: 'rgba(255, 255, 255, 0.04)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}
