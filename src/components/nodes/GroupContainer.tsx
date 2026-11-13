import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Type, Ungroup } from 'lucide-react'
import { useCanvasStore, useUIStore, useHistoryStore } from '../../stores'
import type { NodeGroup, CanvasNode } from '../../stores'
import { GlassPill } from '../glass'

const PADDING = 24 // padding around member nodes inside group boundary

interface GroupContainerProps {
  group: NodeGroup
  memberNodes: CanvasNode[]
}

export function GroupContainer({ group, memberNodes }: GroupContainerProps) {
  const collapsedGroupIds = useUIStore((s) => s.collapsedGroupIds)
  const isCollapsed = collapsedGroupIds.has(group.id)

  // Context menu
  const [ctxOpen, setCtxOpen] = useState(false)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })

  // Rename
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(group.name)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Drag
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ screenX: 0, screenY: 0 })

  // Compute bounding box of member nodes
  const bounds = computeGroupBounds(memberNodes)

  // Focus rename input
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(group.name)
      requestAnimationFrame(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      })
    }
  }, [isRenaming, group.name])

  // Commit rename
  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== group.name) {
      useCanvasStore.getState().updateGroup(group.id, { name: trimmed })
    }
    setIsRenaming(false)
  }, [renameValue, group.id, group.name])

  // Cancel rename
  const cancelRename = useCallback(() => {
    setIsRenaming(false)
  }, [])

  // Ungroup
  const handleUngroup = useCallback(() => {
    const snapshot = { ...group, nodeIds: [...group.nodeIds] }
    useCanvasStore.getState().removeGroup(group.id)
    useUIStore.getState().collapsedGroupIds.delete(group.id)
    useHistoryStore.getState().pushAction({
      id: `h-${Date.now()}-ungroup-${group.id}`,
      type: 'groupRemove',
      timestamp: Date.now(),
      description: `Remove group "${snapshot.name}"`,
      undo: { type: 'groupRemove', group: snapshot },
      redo: { type: 'groupRemove', group: snapshot },
    })
    setCtxOpen(false)
  }, [group])

  // Toggle collapse
  const handleToggleCollapse = useCallback(() => {
    useUIStore.getState().toggleGroupCollapse(group.id)
  }, [group.id])

  // Context menu on right-click or click on label
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxPos({ x: e.clientX, y: e.clientY })
    setCtxOpen(true)
  }, [])

  // Drag: start on label pill mousedown or border mousedown
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || isRenaming) return
      e.stopPropagation()
      e.preventDefault()
      dragStartRef.current = { screenX: e.clientX, screenY: e.clientY }
      setIsDragging(true)
    },
    [isRenaming],
  )

  // Drag: move + up on window
  useEffect(() => {
    if (!isDragging) return

    document.body.style.cursor = 'grabbing'

    const onMove = (e: MouseEvent) => {
      const { zoom } = useCanvasStore.getState()
      const dx = (e.clientX - dragStartRef.current.screenX) / zoom
      const dy = (e.clientY - dragStartRef.current.screenY) / zoom
      dragStartRef.current = { screenX: e.clientX, screenY: e.clientY }
      useCanvasStore.getState().moveNodes(group.nodeIds, { dx, dy })
    }

    const onUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
  }, [isDragging, group.nodeIds])

  if (!bounds) return null

  // Collapsed: show only the label pill at the center of the group bounding box
  if (isCollapsed) {
    return (
      <div
        style={{
          position: 'absolute',
          left: bounds.cx - 60,
          top: bounds.cy - 16,
          zIndex: 0,
        }}
      >
        <GlassPill
          style={{
            height: 32,
            padding: '0 12px',
            gap: 6,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          <button
            type="button"
            aria-label="Expand group"
            onClick={handleToggleCollapse}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronRight size={14} strokeWidth={1.75} />
          </button>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
            }}
            onMouseDown={handleDragStart}
            onContextMenu={handleContextMenu}
          >
            {group.name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            {group.nodeIds.length}
          </span>
        </GlassPill>

        <GroupContextMenu
          open={ctxOpen}
          position={ctxPos}
          onClose={() => setCtxOpen(false)}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onRename={() => {
            setCtxOpen(false)
            setIsRenaming(true)
          }}
          onUngroup={handleUngroup}
          isRenaming={isRenaming}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          renameInputRef={renameInputRef}
          commitRename={commitRename}
          cancelRename={cancelRename}
        />
      </div>
    )
  }

  // Expanded: dashed border around all member nodes + label pill at top-left
  return (
    <div
      style={{
        position: 'absolute',
        left: bounds.x - PADDING,
        top: bounds.y - PADDING - 36, // 36px for label pill above
        width: bounds.w + PADDING * 2,
        height: bounds.h + PADDING * 2 + 36,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Label pill at top-left */}
      <div style={{ pointerEvents: 'auto', marginBottom: 4 }}>
        <GlassPill
          style={{
            height: 32,
            padding: '0 12px',
            gap: 6,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            display: 'inline-flex',
          }}
        >
          <button
            type="button"
            aria-label="Collapse group"
            onClick={handleToggleCollapse}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronDown size={14} strokeWidth={1.75} />
          </button>

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
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--glass-hover)',
                borderRadius: 6,
                padding: '2px 6px',
                height: 24,
                outline: 'none',
                width: 120,
              }}
              aria-label="Rename group"
            />
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}
              onMouseDown={handleDragStart}
              onContextMenu={handleContextMenu}
            >
              {group.name}
            </span>
          )}
        </GlassPill>
      </div>

      {/* Dashed border container */}
      <div
        style={{
          width: '100%',
          height: bounds.h + PADDING * 2,
          borderRadius: 12,
          border: '1px dashed rgba(255,255,255,0.04)',
          pointerEvents: 'auto',
          cursor: isDragging ? 'grabbing' : undefined,
        }}
        onMouseDown={(e) => {
          // Only drag from the border itself (not from nodes inside)
          if (e.target === e.currentTarget) {
            handleDragStart(e)
          }
        }}
        onContextMenu={handleContextMenu}
      />

      <GroupContextMenu
        open={ctxOpen}
        position={ctxPos}
        onClose={() => setCtxOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onRename={() => {
          setCtxOpen(false)
          setIsRenaming(true)
        }}
        onUngroup={handleUngroup}
        isRenaming={isRenaming}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        renameInputRef={renameInputRef}
        commitRename={commitRename}
        cancelRename={cancelRename}
      />
    </div>
  )
}

// --- Group context menu ---

function GroupContextMenu({
  open,
  position,
  onClose,
  isCollapsed,
  onToggleCollapse,
  onRename,
  onUngroup,
}: {
  open: boolean
  position: { x: number; y: number }
  onClose: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onRename: () => void
  onUngroup: () => void
  isRenaming: boolean
  renameValue: string
  setRenameValue: (v: string) => void
  renameInputRef: React.RefObject<HTMLInputElement | null>
  commitRename: () => void
  cancelRename: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => window.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handler)
    }
  }, [open, onClose])

  const clampedPos = { ...position }
  if (typeof window !== 'undefined') {
    const menuW = 200
    const menuH = 140
    if (clampedPos.x + menuW > window.innerWidth) clampedPos.x = window.innerWidth - menuW - 8
    if (clampedPos.y + menuH > window.innerHeight) clampedPos.y = Math.max(8, window.innerHeight - menuH - 8)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: clampedPos.y,
            left: clampedPos.x,
            zIndex: 3000,
          }}
        >
          <motion.div
            className="glass"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', duration: 0.2 }}
            style={{
              borderRadius: 14,
              padding: 6,
              width: 200,
              transformOrigin: 'top left',
            }}
          >
            <button
              type="button"
              onClick={() => {
                onClose()
                onToggleCollapse()
              }}
              className="glass-button"
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                height: 36,
                padding: '0 10px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              {isCollapsed ? (
                <ChevronRight size={16} strokeWidth={1.75} />
              ) : (
                <ChevronDown size={16} strokeWidth={1.75} />
              )}
              <span style={{ flex: 1, textAlign: 'left' }}>{isCollapsed ? 'Expand' : 'Collapse'}</span>
            </button>
            <button
              type="button"
              onClick={onRename}
              className="glass-button"
              aria-label="Rename group"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                height: 36,
                padding: '0 10px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              <Type size={16} strokeWidth={1.75} />
              <span style={{ flex: 1, textAlign: 'left' }}>Rename</span>
            </button>
            <div
              style={{
                height: 1,
                background: 'var(--glass-border)',
                opacity: 0.3,
                margin: '4px 0',
              }}
            />
            <button
              type="button"
              onClick={onUngroup}
              className="glass-button"
              aria-label="Ungroup"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                height: 36,
                padding: '0 10px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              <Ungroup size={16} strokeWidth={1.75} />
              <span style={{ flex: 1, textAlign: 'left' }}>Ungroup</span>
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// --- Helpers ---

function computeGroupBounds(
  nodes: CanvasNode[],
): { x: number; y: number; w: number; h: number; cx: number; cy: number } | null {
  if (nodes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + n.size.w)
    maxY = Math.max(maxY, n.position.y + n.size.h)
  }
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
}
