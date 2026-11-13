import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Cpu,
  Download,
  Trash2,
  Copy,
  Search,
  Camera,
  FileText,
  FileDown,
  ExternalLink,
  RotateCw,
  Pencil,
  RefreshCw,
  Sparkles,
  GitCompareArrows,
  Pin,
  Bookmark,
  Type,
  Layers,
  X,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { useCanvasStore, useAgentStore, useUIStore, useHistoryStore } from '../../stores'
import type { CanvasNode } from '../../stores'
import { duplicateNode } from '../chrome/AddElementsDropdown'
import { removeNodeWithHistory } from '../../hooks/useCanvasShortcuts'

// --- Shared menu item ---

const SHORTCUT_STYLE: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.06)',
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
}

function ContextMenuItem({
  icon,
  label,
  shortcut,
  onClick,
  onMouseEnter,
  onMouseLeave,
  trailing,
}: {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="glass-button"
      aria-label={label}
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
      {icon}
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {shortcut && <span style={SHORTCUT_STYLE}>{shortcut}</span>}
      {trailing}
    </button>
  )
}

function ContextMenuDivider() {
  return (
    <div
      style={{
        height: 1,
        background: 'var(--glass-border)',
        opacity: 0.3,
        margin: '4px 0',
      }}
    />
  )
}

// --- Agent sub-menu ---

function AgentSubMenu({ onSelect }: { onSelect: (agentId: string) => void }) {
  const agents = useAgentStore((s) => s.agents)
  if (agents.length === 0) {
    return (
      <motion.div
        className="glass"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ type: 'spring', duration: 0.2 }}
        style={{
          position: 'absolute',
          top: 0,
          left: '100%',
          marginLeft: 4,
          width: 180,
          borderRadius: 14,
          padding: '10px 14px',
          zIndex: 3001,
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            color: 'var(--text-tertiary)',
          }}
        >
          No agents configured
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="glass"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ type: 'spring', duration: 0.2 }}
      style={{
        position: 'absolute',
        top: 0,
        left: '100%',
        marginLeft: 4,
        width: 180,
        borderRadius: 14,
        padding: 6,
        maxHeight: 240,
        overflowY: 'auto',
        zIndex: 3001,
      }}
    >
      {agents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          onClick={() => onSelect(agent.id)}
          className="glass-button"
          aria-label={agent.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            height: 32,
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
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: agent.color,
              flexShrink: 0,
            }}
          />
          {agent.name}
        </button>
      ))}
    </motion.div>
  )
}

// --- Sub-menu wrapper with hover delay ---

function SubMenuItem({
  icon,
  label,
  subMenuKey,
  activeSubMenu,
  onShowSub,
  onHideSub,
  onCancelHide,
  children,
}: {
  icon: React.ReactNode
  label: string
  subMenuKey: string
  activeSubMenu: string | null
  onShowSub: (key: string) => void
  onHideSub: () => void
  onCancelHide: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => onShowSub(subMenuKey)} onMouseLeave={onHideSub}>
      <ContextMenuItem
        icon={icon}
        label={label}
        onClick={() => onShowSub(subMenuKey)}
        trailing={<ChevronRight size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />}
      />
      <AnimatePresence>
        {activeSubMenu === subMenuKey && (
          <div onMouseEnter={onCancelHide} onMouseLeave={onHideSub}>
            {children}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- Group sub-menu ---

let groupCounter = 0

export function getNextGroupId(): string {
  const existing = useCanvasStore.getState().groups
  for (const g of existing) {
    const m = g.id.match(/^g(\d+)$/)
    if (m) groupCounter = Math.max(groupCounter, parseInt(m[1], 10))
  }
  return `g${++groupCounter}`
}

function GroupSubMenu({ nodeId, onDone }: { nodeId: string; onDone: () => void }) {
  const groups = useCanvasStore((s) => s.groups)

  const handleAddToGroup = useCallback(
    (groupId: string) => {
      useCanvasStore.getState().addNodeToGroup(groupId, nodeId)
      onDone()
    },
    [nodeId, onDone],
  )

  const handleNewGroup = useCallback(() => {
    const name = window.prompt('Group name:')
    if (!name?.trim()) return
    const id = getNextGroupId()
    const group = { id, name: name.trim(), nodeIds: [nodeId] }
    useCanvasStore.getState().addGroup(group)
    useHistoryStore.getState().pushAction({
      id: `h-${Date.now()}-group-${id}`,
      type: 'groupCreate',
      timestamp: Date.now(),
      description: `Create group "${group.name}"`,
      undo: { type: 'groupCreate', group },
      redo: { type: 'groupCreate', group },
    })
    onDone()
  }, [nodeId, onDone])

  return (
    <motion.div
      className="glass"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ type: 'spring', duration: 0.2 }}
      style={{
        position: 'absolute',
        top: 0,
        left: '100%',
        marginLeft: 4,
        width: 200,
        borderRadius: 14,
        padding: 6,
        maxHeight: 280,
        overflowY: 'auto',
        zIndex: 3001,
      }}
    >
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => handleAddToGroup(g.id)}
          className="glass-button"
          aria-label={g.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            height: 32,
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
          <Layers size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <span
            style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {g.name}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{g.nodeIds.length}</span>
        </button>
      ))}
      {groups.length > 0 && (
        <div
          style={{
            height: 1,
            background: 'var(--glass-border)',
            opacity: 0.3,
            margin: '4px 0',
          }}
        />
      )}
      <button
        type="button"
        onClick={handleNewGroup}
        className="glass-button"
        aria-label="New Group"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          height: 32,
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
        <Plus size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        New Group
      </button>
    </motion.div>
  )
}

// --- Main Context Menu ---

const ICON_SIZE = 16
const ICON_SW = 1.75

interface NodeContextMenuProps {
  node: CanvasNode
  open: boolean
  position: { x: number; y: number }
  onClose: () => void
}

export function NodeContextMenu({ node, open, position, onClose }: NodeContextMenuProps) {
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const subTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on Esc
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

  // Close on click-outside
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

  // Reset sub-menu on close
  useEffect(() => {
    if (!open) setActiveSubMenu(null)
  }, [open])

  // Sub-menu hover
  const showSub = useCallback((key: string) => {
    if (subTimer.current) clearTimeout(subTimer.current)
    setActiveSubMenu(key)
  }, [])

  const hideSub = useCallback(() => {
    subTimer.current = setTimeout(() => setActiveSubMenu(null), 150)
  }, [])

  const cancelHideSub = useCallback(() => {
    if (subTimer.current) clearTimeout(subTimer.current)
  }, [])

  // --- Actions ---

  const handleCloseNode = useCallback(() => {
    removeNodeWithHistory(node.id)
    const ui = useUIStore.getState()
    if (ui.focusedNodeId === node.id) ui.setFocusedNodeId(null)
    onClose()
  }, [node.id, onClose])

  const handleDuplicate = useCallback(() => {
    duplicateNode(node.id)
    onClose()
  }, [node.id, onClose])

  const handleRename = useCallback(() => {
    useUIStore.getState().setRenamingNodeId(node.id)
    onClose()
  }, [node.id, onClose])

  const handleAgentSelect = useCallback(
    (_agentId: string) => {
      // Agent integration handled in future stories (US-023+)
      onClose()
    },
    [onClose],
  )

  const noop = useCallback(() => {
    onClose()
  }, [onClose])

  // Clamp menu to viewport
  const clampedPos = { ...position }
  if (typeof window !== 'undefined') {
    const menuW = 240
    const menuH = 500 // approximate max
    if (clampedPos.x + menuW > window.innerWidth) clampedPos.x = window.innerWidth - menuW - 8
    if (clampedPos.y + menuH > window.innerHeight) clampedPos.y = Math.max(8, window.innerHeight - menuH - 8)
  }

  // Type-specific items
  const renderTypeItems = () => {
    switch (node.type) {
      case 'terminal':
        return (
          <>
            <ContextMenuItem
              icon={<Play size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Run command"
              onClick={noop}
            />
            <SubMenuItem
              icon={<Cpu size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Pipe output to agent"
              subMenuKey="pipe"
              activeSubMenu={activeSubMenu}
              onShowSub={showSub}
              onHideSub={hideSub}
              onCancelHide={cancelHideSub}
            >
              <AgentSubMenu onSelect={handleAgentSelect} />
            </SubMenuItem>
            <ContextMenuItem
              icon={<Download size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Export session log"
              onClick={noop}
            />
            <ContextMenuItem
              icon={<Trash2 size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Clear terminal"
              shortcut="⌘K"
              onClick={noop}
            />
            <ContextMenuDivider />
            <ContextMenuItem
              icon={<Copy size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Copy last output"
              onClick={noop}
            />
            <ContextMenuItem
              icon={<Search size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Search in terminal"
              shortcut="⌘F"
              onClick={noop}
            />
          </>
        )

      case 'browser':
        return (
          <>
            <ContextMenuItem
              icon={<Camera size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Screenshot page"
              onClick={noop}
            />
            <ContextMenuItem
              icon={<FileText size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Extract page text"
              onClick={noop}
            />
            <SubMenuItem
              icon={<Cpu size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Connect agent via CDP"
              subMenuKey="cdp"
              activeSubMenu={activeSubMenu}
              onShowSub={showSub}
              onHideSub={hideSub}
              onCancelHide={cancelHideSub}
            >
              <AgentSubMenu onSelect={handleAgentSelect} />
            </SubMenuItem>
            <ContextMenuItem
              icon={<FileDown size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Save as PDF"
              onClick={noop}
            />
            <ContextMenuDivider />
            <ContextMenuItem icon={<Copy size={ICON_SIZE} strokeWidth={ICON_SW} />} label="Copy URL" onClick={noop} />
            <ContextMenuItem
              icon={<ExternalLink size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Open in system browser"
              onClick={noop}
            />
            <ContextMenuItem
              icon={<RotateCw size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Reload"
              shortcut="⌘R"
              onClick={noop}
            />
          </>
        )

      case 'file':
        return (
          <>
            <ContextMenuItem
              icon={<ExternalLink size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Open in default app"
              onClick={noop}
            />
            <ContextMenuItem
              icon={<Pencil size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Edit in canvas"
              onClick={noop}
            />
            <SubMenuItem
              icon={<RefreshCw size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Convert format"
              subMenuKey="convert"
              activeSubMenu={activeSubMenu}
              onShowSub={showSub}
              onHideSub={hideSub}
              onCancelHide={cancelHideSub}
            >
              <AgentSubMenu onSelect={handleAgentSelect} />
            </SubMenuItem>
            <SubMenuItem
              icon={<Cpu size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Send to agent"
              subMenuKey="sendAgent"
              activeSubMenu={activeSubMenu}
              onShowSub={showSub}
              onHideSub={hideSub}
              onCancelHide={cancelHideSub}
            >
              <AgentSubMenu onSelect={handleAgentSelect} />
            </SubMenuItem>
            <ContextMenuDivider />
            <ContextMenuItem
              icon={<Download size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Save as"
              onClick={noop}
            />
            <ContextMenuItem icon={<Copy size={ICON_SIZE} strokeWidth={ICON_SW} />} label="Copy path" onClick={noop} />
            <ContextMenuItem
              icon={<Trash2 size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Delete file"
              onClick={noop}
            />
          </>
        )

      default:
        return null
    }
  }

  const hasTypeItems = node.type === 'terminal' || node.type === 'browser' || node.type === 'file'

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
              width: 240,
              transformOrigin: 'top left',
            }}
          >
            {renderTypeItems()}
            {hasTypeItems && <ContextMenuDivider />}

            {/* Common items */}
            <ContextMenuItem
              icon={<Type size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Rename"
              shortcut="F2"
              onClick={handleRename}
            />
            <SubMenuItem
              icon={<Layers size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Move to group"
              subMenuKey="group"
              activeSubMenu={activeSubMenu}
              onShowSub={showSub}
              onHideSub={hideSub}
              onCancelHide={cancelHideSub}
            >
              <GroupSubMenu nodeId={node.id} onDone={onClose} />
            </SubMenuItem>
            <ContextMenuItem
              icon={<Copy size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Duplicate"
              shortcut="⌘D"
              onClick={handleDuplicate}
            />
            <ContextMenuItem
              icon={<X size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Close"
              shortcut="⌘W"
              onClick={handleCloseNode}
            />

            {/* Universal items */}
            <ContextMenuDivider />
            <ContextMenuItem
              icon={<Sparkles size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Summarize with agent"
              onClick={noop}
            />
            <ContextMenuItem
              icon={<GitCompareArrows size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Compare with"
              onClick={noop}
            />
            <ContextMenuItem
              icon={<Pin size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Pin to canvas"
              onClick={noop}
            />
            <ContextMenuItem
              icon={<Bookmark size={ICON_SIZE} strokeWidth={ICON_SW} />}
              label="Bookmark"
              onClick={noop}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
