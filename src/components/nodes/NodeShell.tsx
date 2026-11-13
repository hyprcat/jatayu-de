import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreHorizontal, ChevronLeft, RotateCw, Clock } from 'lucide-react'
import { useCanvasStore, useUIStore, useHistoryStore } from '../../stores'
import type { CanvasNode, NodeType } from '../../stores'
import { NodeContextMenu } from './NodeContextMenu'

const MIN_SIZES: Record<NodeType, { w: number; h: number }> = {
  terminal: { w: 320, h: 200 },
  browser: { w: 400, h: 300 },
  file: { w: 200, h: 160 },
  webapp: { w: 400, h: 300 },
  note: { w: 160, h: 120 },
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  terminal: 'Terminal',
  browser: 'Browser',
  file: 'File',
  webapp: 'Web App',
  note: 'Note',
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

const RESIZE_CURSORS: Record<ResizeDir, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  se: 'nwse-resize',
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

interface NodeShellProps {
  node: CanvasNode
  children?: ReactNode
}

export function NodeShell({ node, children }: NodeShellProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [resizeDir, setResizeDir] = useState<ResizeDir | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Context menu state
  const [ctxMenuOpen, setCtxMenuOpen] = useState(false)
  const [ctxMenuPos, setCtxMenuPos] = useState({ x: 0, y: 0 })

  // Rename mode
  const renamingNodeId = useUIStore((s) => s.renamingNodeId)
  const isRenaming = renamingNodeId === node.id
  const [renameValue, setRenameValue] = useState(node.title)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const focusedNodeId = useUIStore((s) => s.focusedNodeId)
  const isFocused = focusedNodeId === node.id
  const focusLayer = useUIStore((s) => s.focusLayer)
  const showFocusRing = isFocused && (focusLayer === 'node' || focusLayer === 'canvas')
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const isSelected = selectedIds.has(node.id)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  const dragStartRef = useRef({ screenX: 0, screenY: 0, nodeX: 0, nodeY: 0 })
  const resizeStartRef = useRef({
    screenX: 0,
    screenY: 0,
    nodeX: 0,
    nodeY: 0,
    nodeW: 0,
    nodeH: 0,
  })

  // Cleanup tooltip timer on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    }
  }, [])

  // Focus rename input when rename mode activates
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(node.title)
      requestAnimationFrame(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      })
    }
  }, [isRenaming, node.title])

  // Focus node on click; Cmd+Click toggles selection
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey) {
        // Toggle this node in/out of multi-select
        useCanvasStore.getState().toggleSelectedId(node.id)
        return
      }
      useCanvasStore.getState().focusNode(node.id)
      const ui = useUIStore.getState()
      ui.setFocusedNodeId(node.id)
      ui.setFocusLayer('node')
    },
    [node.id],
  )

  // Right-click → context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      useCanvasStore.getState().focusNode(node.id)
      useUIStore.getState().setFocusedNodeId(node.id)
      setCtxMenuPos({ x: e.clientX, y: e.clientY })
      setCtxMenuOpen(true)
    },
    [node.id],
  )

  // ··· button → context menu
  const handleMoreClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setCtxMenuPos({ x: rect.right, y: rect.bottom + 4 })
    setCtxMenuOpen(true)
  }, [])

  // Rename: commit
  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== node.title) {
      const oldTitle = node.title
      useCanvasStore.getState().updateNode(node.id, {
        title: trimmed,
        metadata: { ...node.metadata, modifiedAt: Date.now() },
      })
      // Track rename in undo history
      useHistoryStore.getState().pushAction({
        id: `h-${Date.now()}-rename-${node.id}`,
        type: 'renameNode',
        timestamp: Date.now(),
        description: `Rename "${oldTitle}" → "${trimmed}"`,
        undo: { type: 'renameNode', nodeId: node.id, title: oldTitle },
        redo: { type: 'renameNode', nodeId: node.id, title: trimmed },
      })
    }
    useUIStore.getState().setRenamingNodeId(null)
  }, [renameValue, node.id, node.title, node.metadata])

  // Rename: cancel
  const cancelRename = useCallback(() => {
    useUIStore.getState().setRenamingNodeId(null)
  }, [])

  // Title bar tooltip
  const showTooltip = useCallback(() => {
    tooltipTimer.current = setTimeout(() => setTooltipVisible(true), 800)
  }, [])

  const hideTooltip = useCallback(() => {
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current)
      tooltipTimer.current = null
    }
    setTooltipVisible(false)
  }, [])

  // Drag: start on title bar mousedown
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      hideTooltip()
      dragStartRef.current = {
        screenX: e.clientX,
        screenY: e.clientY,
        nodeX: node.position.x,
        nodeY: node.position.y,
      }
      setIsDragging(true)
      useCanvasStore.getState().focusNode(node.id)
      useUIStore.getState().setFocusedNodeId(node.id)
    },
    [node.position.x, node.position.y, node.id, hideTooltip],
  )

  // Drag: move + up handlers on window
  useEffect(() => {
    if (!isDragging) return

    document.body.style.cursor = 'grabbing'

    const onMove = (e: MouseEvent) => {
      const { zoom } = useCanvasStore.getState()
      const dx = (e.clientX - dragStartRef.current.screenX) / zoom
      const dy = (e.clientY - dragStartRef.current.screenY) / zoom
      useCanvasStore.getState().moveNode(node.id, {
        x: dragStartRef.current.nodeX + dx,
        y: dragStartRef.current.nodeY + dy,
      })
    }

    const onUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''

      // Push move to undo history if position actually changed
      const currentNode = useCanvasStore.getState().nodes.find((n) => n.id === node.id)
      const oldPos = { x: dragStartRef.current.nodeX, y: dragStartRef.current.nodeY }
      if (currentNode && (currentNode.position.x !== oldPos.x || currentNode.position.y !== oldPos.y)) {
        useHistoryStore.getState().pushAction({
          id: `h-${Date.now()}-move-${node.id}`,
          type: 'moveNode',
          timestamp: Date.now(),
          description: `Move "${currentNode.title}"`,
          undo: { type: 'moveNode', nodeId: node.id, position: oldPos },
          redo: { type: 'moveNode', nodeId: node.id, position: { ...currentNode.position } },
        })
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
  }, [isDragging, node.id])

  // Resize: start on handle mousedown
  const handleResizeStart = useCallback(
    (dir: ResizeDir, e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      resizeStartRef.current = {
        screenX: e.clientX,
        screenY: e.clientY,
        nodeX: node.position.x,
        nodeY: node.position.y,
        nodeW: node.size.w,
        nodeH: node.size.h,
      }
      setResizeDir(dir)
    },
    [node.position.x, node.position.y, node.size.w, node.size.h],
  )

  // Resize: move + up handlers on window
  useEffect(() => {
    if (!resizeDir) return

    const min = MIN_SIZES[node.type]
    document.body.style.cursor = RESIZE_CURSORS[resizeDir]

    const onMove = (e: MouseEvent) => {
      const { zoom } = useCanvasStore.getState()
      const dx = (e.clientX - resizeStartRef.current.screenX) / zoom
      const dy = (e.clientY - resizeStartRef.current.screenY) / zoom
      const s = resizeStartRef.current

      let newX = s.nodeX
      let newY = s.nodeY
      let newW = s.nodeW
      let newH = s.nodeH

      if (resizeDir.includes('e')) {
        newW = Math.max(min.w, s.nodeW + dx)
      }
      if (resizeDir.includes('w')) {
        const dw = Math.min(dx, s.nodeW - min.w)
        newX = s.nodeX + dw
        newW = s.nodeW - dw
      }
      if (resizeDir.includes('s')) {
        newH = Math.max(min.h, s.nodeH + dy)
      }
      if (resizeDir.includes('n')) {
        const dh = Math.min(dy, s.nodeH - min.h)
        newY = s.nodeY + dh
        newH = s.nodeH - dh
      }

      const store = useCanvasStore.getState()
      store.moveNode(node.id, { x: newX, y: newY })
      store.resizeNode(node.id, { w: newW, h: newH })
    }

    const onUp = () => {
      setResizeDir(null)
      document.body.style.cursor = ''

      // Push resize to undo history if size actually changed
      const currentNode = useCanvasStore.getState().nodes.find((n) => n.id === node.id)
      const s = resizeStartRef.current
      if (currentNode && (currentNode.size.w !== s.nodeW || currentNode.size.h !== s.nodeH)) {
        useHistoryStore.getState().pushAction({
          id: `h-${Date.now()}-resize-${node.id}`,
          type: 'resizeNode',
          timestamp: Date.now(),
          description: `Resize "${currentNode.title}"`,
          undo: { type: 'resizeNode', nodeId: node.id, size: { w: s.nodeW, h: s.nodeH } },
          redo: { type: 'resizeNode', nodeId: node.id, size: { ...currentNode.size } },
        })
      }

      // Also track position change from resize (e.g. resizing from N/W edge moves position)
      if (currentNode && (currentNode.position.x !== s.nodeX || currentNode.position.y !== s.nodeY)) {
        useHistoryStore.getState().pushAction({
          id: `h-${Date.now()}-resizemove-${node.id}`,
          type: 'moveNode',
          timestamp: Date.now(),
          description: `Resize-move "${currentNode.title}"`,
          undo: { type: 'moveNode', nodeId: node.id, position: { x: s.nodeX, y: s.nodeY } },
          redo: { type: 'moveNode', nodeId: node.id, position: { ...currentNode.position } },
        })
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
  }, [resizeDir, node.id, node.type])

  const createdAt = node.metadata.createdAt as number | undefined
  const modifiedAt = node.metadata.modifiedAt as number | undefined

  // File nodes are chromeless at rest — title bar and border only appear on hover
  const isChromeless = node.type === 'file'
  const showChrome = !isChromeless || isHovered || isDragging || !!resizeDir || isFocused

  // Materialization animation for artifact-created nodes
  const isMaterializing = !!node.metadata.materializing

  const materializeDelay = typeof node.metadata.materializeDelay === 'number' ? node.metadata.materializeDelay : 0

  // Clear materializing flag after animation completes (animation duration + delay)
  useEffect(() => {
    if (!isMaterializing) return
    const timer = setTimeout(() => {
      useCanvasStore.getState().updateNode(node.id, {
        metadata: { ...node.metadata, materializing: undefined, materializeDelay: undefined },
      })
    }, 400 + materializeDelay)
    return () => clearTimeout(timer)
  }, [isMaterializing, node.id, node.metadata, materializeDelay])

  // Listen for keyboard-triggered context menu (⌘Enter)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { nodeId: string; x: number; y: number }
      if (detail.nodeId === node.id) {
        setCtxMenuPos({ x: detail.x, y: detail.y })
        setCtxMenuOpen(true)
      }
    }
    window.addEventListener('flow:node-context-menu', handler)
    return () => window.removeEventListener('flow:node-context-menu', handler)
  }, [node.id])

  // Agent touch flash — glow when agent reads/writes this node
  const touchTimestamp = useUIStore((s) => s.nodeTouches[node.id])
  const [isTouched, setIsTouched] = useState(false)

  useEffect(() => {
    if (!touchTimestamp) {
      setIsTouched(false)
      return
    }
    setIsTouched(true)
    const timer = setTimeout(() => {
      setIsTouched(false)
      useUIStore.getState().removeNodeTouch(node.id)
    }, 400)
    return () => clearTimeout(timer)
  }, [touchTimestamp, node.id])

  const outerClassName =
    [
      isMaterializing ? 'node-materializing' : '',
      isTouched ? 'node-agent-touch' : '',
      showFocusRing ? 'node-keyboard-focus' : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div
      className={outerClassName}
      role="region"
      aria-label={`${NODE_TYPE_LABELS[node.type]} ${node.title} window ${node.id}`}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: node.size.w,
        height: node.size.h,
        zIndex: node.zIndex,
        cursor: isChromeless && !isHovered ? 'pointer' : undefined,
        ...(isMaterializing && materializeDelay > 0 ? { animationDelay: `${materializeDelay}ms`, opacity: 0 } : {}),
      }}
      onMouseDown={handleNodeMouseDown}
      onContextMenu={handleContextMenu}
    >
      {/* Visual container with border-radius + clipping */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: isChromeless ? 8 : 12,
          border: isChromeless
            ? `1px solid ${showChrome ? 'var(--glass-border)' : 'transparent'}`
            : `1px solid var(${isFocused ? '--glass-hover' : '--glass-border'})`,
          background: 'var(--node-bg)',
          boxShadow: isChromeless
            ? showChrome && isFocused
              ? '0 0 0 1px var(--glass-hover), 0 8px 32px rgba(0,0,0,0.35)'
              : '0 2px 12px rgba(0,0,0,0.15)'
            : isFocused
              ? '0 0 0 1px var(--glass-hover), 0 8px 32px rgba(0,0,0,0.35)'
              : '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'border-color 200ms ease, box-shadow 200ms var(--ease-spring)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false)
          hideTooltip()
        }}
      >
        {/* Title bar — 32px; for file nodes, appears as frosted overlay on hover */}
        {isChromeless ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 8px',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              zIndex: 5,
              background: 'rgba(20,20,24,0.65)',
              backdropFilter: 'blur(16px) saturate(1.3)',
              borderBottom: '1px solid var(--glass-border)',
              borderRadius: '8px 8px 0 0',
              opacity: showChrome ? 1 : 0,
              transition: 'opacity 200ms ease',
              pointerEvents: showChrome ? 'auto' : 'none',
            }}
            onMouseDown={handleDragStart}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
          >
            {/* Window ID badge */}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                flexShrink: 0,
                ...(isSelected
                  ? {
                      border: '1px solid var(--accent-blue)',
                      borderRadius: 4,
                      padding: '0 3px',
                    }
                  : {}),
              }}
            >
              [{node.id}]
            </span>

            {/* Title — inline rename or static text */}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') cancelRename()
                  e.stopPropagation()
                }}
                onBlur={commitRename}
                onMouseDown={(e) => e.stopPropagation()}
                className="glass-input"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--glass-hover)',
                  borderRadius: 6,
                  padding: '2px 6px',
                  height: 24,
                  outline: 'none',
                  minWidth: 0,
                }}
                aria-label="Rename node"
              />
            ) : (
              <span
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.title}
              </span>
            )}

            {/* More button */}
            <div style={{ flexShrink: 0 }}>
              <button
                ref={moreButtonRef}
                type="button"
                aria-label="Node options"
                className="glass-button"
                style={{ width: 24, height: 24, borderRadius: 6 }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleMoreClick}
              >
                <MoreHorizontal size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: 32,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 8px',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              flexShrink: 0,
              borderBottom: '1px solid var(--glass-border)',
            }}
            onMouseDown={handleDragStart}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
          >
            {/* Browser-specific nav buttons */}
            {node.type === 'browser' && (
              <>
                <button
                  type="button"
                  aria-label="Go back"
                  className="glass-button"
                  style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => window.electronAPI.invoke('browser:goBack', node.id)}
                >
                  <ChevronLeft size={14} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="Reload"
                  className="glass-button"
                  style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => window.electronAPI.invoke('browser:reload', node.id)}
                >
                  <RotateCw size={12} strokeWidth={1.75} />
                </button>
              </>
            )}

            {/* Agent connected badge for browser/webapp nodes */}
            {(node.type === 'browser' || node.type === 'webapp') && !!node.metadata.agentConnected && (
              <motion.span
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  fontSize: 'var(--text-xs)',
                  flexShrink: 0,
                  lineHeight: 1,
                }}
                aria-label="Agent connected"
              >
                🤖
              </motion.span>
            )}

            {/* Window ID badge */}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                flexShrink: 0,
                ...(isSelected
                  ? {
                      border: '1px solid var(--accent-blue)',
                      borderRadius: 4,
                      padding: '0 3px',
                    }
                  : {}),
              }}
            >
              [{node.id}]
            </span>

            {/* Title — inline rename input or static text */}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') cancelRename()
                  e.stopPropagation()
                }}
                onBlur={commitRename}
                onMouseDown={(e) => e.stopPropagation()}
                className="glass-input"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--glass-hover)',
                  borderRadius: 6,
                  padding: '2px 6px',
                  height: 24,
                  outline: 'none',
                  minWidth: 0,
                }}
                aria-label="Rename node"
              />
            ) : (
              <span
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.title}
              </span>
            )}

            {/* More button — visible on hover */}
            <div style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 150ms', flexShrink: 0 }}>
              <button
                ref={moreButtonRef}
                type="button"
                aria-label="Node options"
                className="glass-button"
                style={{ width: 24, height: 24, borderRadius: 6 }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleMoreClick}
              >
                <MoreHorizontal size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>{children}</div>
      </div>

      {/* Selected node ring — dashed 2px monochrome ring */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: isChromeless ? 11 : 15,
            border: '2px dashed rgba(255, 255, 255, 0.35)',
            pointerEvents: 'none',
            zIndex: 15,
          }}
        />
      )}

      {/* Title bar tooltip — Created X ago · Modified Y ago */}
      <AnimatePresence>
        {tooltipVisible && createdAt && !isDragging && (
          <motion.div
            className="glass"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: 36,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Clock size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            Created {timeAgo(createdAt)}
            {modifiedAt && ` · Modified ${timeAgo(modifiedAt)}`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resize handles — visible on node hover (always for non-chromeless; on hover for chromeless) */}
      {(isHovered || resizeDir) && !isDragging && (
        <>
          {(['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as ResizeDir[]).map((dir) => (
            <ResizeHandle key={dir} dir={dir} onStart={handleResizeStart} />
          ))}
        </>
      )}

      {/* Context menu — portaled to body */}
      <NodeContextMenu node={node} open={ctxMenuOpen} position={ctxMenuPos} onClose={() => setCtxMenuOpen(false)} />
    </div>
  )
}

function ResizeHandle({ dir, onStart }: { dir: ResizeDir; onStart: (dir: ResizeDir, e: React.MouseEvent) => void }) {
  const isCorner = dir.length === 2
  const H = 8

  const style: React.CSSProperties = {
    position: 'absolute',
    cursor: RESIZE_CURSORS[dir],
    zIndex: 10,
  }

  switch (dir) {
    case 'n':
      style.top = -H / 2
      style.left = H
      style.right = H
      style.height = H
      break
    case 's':
      style.bottom = -H / 2
      style.left = H
      style.right = H
      style.height = H
      break
    case 'e':
      style.right = -H / 2
      style.top = H
      style.bottom = H
      style.width = H
      break
    case 'w':
      style.left = -H / 2
      style.top = H
      style.bottom = H
      style.width = H
      break
    case 'nw':
      style.top = -H / 2
      style.left = -H / 2
      style.width = H * 1.5
      style.height = H * 1.5
      break
    case 'ne':
      style.top = -H / 2
      style.right = -H / 2
      style.width = H * 1.5
      style.height = H * 1.5
      break
    case 'sw':
      style.bottom = -H / 2
      style.left = -H / 2
      style.width = H * 1.5
      style.height = H * 1.5
      break
    case 'se':
      style.bottom = -H / 2
      style.right = -H / 2
      style.width = H * 1.5
      style.height = H * 1.5
      break
  }

  return (
    <div style={style} onMouseDown={(e) => onStart(dir, e)}>
      {isCorner && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--text-tertiary)',
            opacity: 0.5,
          }}
        />
      )}
    </div>
  )
}
