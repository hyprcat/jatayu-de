import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, Send, Layers, X, ChevronDown } from 'lucide-react'
import { GlassPill } from '../glass'
import { useCanvasStore, useAgentStore, useUIStore, useHistoryStore } from '../../stores'
import type { CanvasNode } from '../../stores'
import { getNextGroupId } from '../nodes/NodeContextMenu'
import { removeNodeWithHistory } from '../../hooks/useCanvasShortcuts'

export function SelectionBar() {
  const selectedIds = useCanvasStore((s) => s.selectedIds)
  const nodes = useCanvasStore((s) => s.nodes)
  const agents = useAgentStore((s) => s.agents)
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedNodes: CanvasNode[] = nodes.filter((n) => selectedIds.has(n.id))
  const count = selectedNodes.length

  // Close agent dropdown on click-outside
  useEffect(() => {
    if (!agentDropdownOpen) return
    const onMouseDown = (e: MouseEvent) => {
      setTimeout(() => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setAgentDropdownOpen(false)
        }
      }, 0)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [agentDropdownOpen])

  // Handle Group action
  const handleGroup = useCallback(() => {
    if (count < 2) return
    const name = window.prompt('Group name:')
    if (!name?.trim()) return
    const id = getNextGroupId()
    const group = { id, name: name.trim(), nodeIds: [...selectedIds] }
    useCanvasStore.getState().addGroup(group)
    useHistoryStore.getState().pushAction({
      id: `h-${Date.now()}-group-${id}`,
      type: 'groupCreate',
      timestamp: Date.now(),
      description: `Create group "${group.name}"`,
      undo: { type: 'groupCreate', group },
      redo: { type: 'groupCreate', group },
    })
    useCanvasStore.getState().clearSelection()
  }, [selectedIds, count])

  // Handle Close All action
  const handleCloseAll = useCallback(() => {
    if (!window.confirm(`Close ${count} selected nodes?`)) return
    for (const id of selectedIds) {
      removeNodeWithHistory(id)
    }
    useCanvasStore.getState().clearSelection()
    useUIStore.getState().setFocusedNodeId(null)
  }, [selectedIds, count])

  // Handle Clear selection
  const handleClear = useCallback(() => {
    useCanvasStore.getState().clearSelection()
  }, [])

  // Handle Send to Agent
  const handleSendToAgent = useCallback(() => {
    const agentId = selectedAgentId ?? agents[0]?.id
    if (!agentId) return

    // Format context block from selected nodes
    const contextLines: string[] = [`--- ${count} nodes selected ---`]
    for (const n of selectedNodes) {
      contextLines.push(`[${n.id}] ${n.type}: ${n.title}`)
    }
    const contextBlock = contextLines.join('\n')

    // Open agent panel with active agent set
    const ui = useUIStore.getState()
    ui.setActiveAgentId(agentId)
    ui.setAgentPanelOpen(true)

    // Add a pre-filled context message to the conversation
    const { activeCanvasId } = useCanvasStore.getState()
    const key = `${agentId}:${activeCanvasId}`
    useAgentStore.getState().addMessage(key, {
      id: `msg-ctx-${Date.now()}`,
      role: 'user',
      content: contextBlock,
      timestamp: Date.now(),
    })

    useCanvasStore.getState().clearSelection()
  }, [selectedAgentId, agents, count, selectedNodes])

  if (count < 2) return null

  // Build selected node labels preview (truncated)
  const labels = selectedNodes.slice(0, 3).map((n) => `[${n.id}] ${n.title}`)
  const labelStr = labels.join('  ') + (count > 3 ? `  …+${count - 3}` : '')

  const activeAgent = agents.find((a) => a.id === (selectedAgentId ?? agents[0]?.id))

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
        }}
      >
        <GlassPill
          style={{
            padding: '6px 12px',
            gap: 8,
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            color: 'var(--text-secondary)',
            maxWidth: 720,
          }}
        >
          {/* Node count + labels */}
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0, color: 'var(--text-primary)' }}>
            {count} nodes selected:
          </span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            {labelStr}
          </span>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

          {/* Agent picker dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              aria-label="Select agent"
              className="glass-button"
              style={{
                height: 28,
                borderRadius: 8,
                padding: '0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-body)',
                color: 'var(--text-secondary)',
              }}
              onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
            >
              <Cpu size={14} strokeWidth={1.75} />
              <span>{activeAgent?.name ?? 'Agent'}</span>
              <ChevronDown size={12} strokeWidth={1.75} />
            </button>
            {agentDropdownOpen && agents.length > 0 && (
              <div
                className="glass"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: 6,
                  padding: 4,
                  borderRadius: 10,
                  minWidth: 160,
                  zIndex: 3000,
                }}
              >
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className="glass-button"
                    style={{
                      width: '100%',
                      height: 32,
                      borderRadius: 6,
                      padding: '0 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-primary)',
                    }}
                    onClick={() => {
                      setSelectedAgentId(agent.id)
                      setAgentDropdownOpen(false)
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: agent.color,
                        flexShrink: 0,
                      }}
                    />
                    <span>{agent.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send to Agent button */}
          <button
            type="button"
            aria-label="Send selection to agent"
            className="glass-button"
            style={{
              height: 28,
              borderRadius: 8,
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-primary)',
              background: agents.length > 0 ? 'rgba(10, 132, 255, 0.15)' : undefined,
              flexShrink: 0,
            }}
            onClick={handleSendToAgent}
            disabled={agents.length === 0}
          >
            <Send size={13} strokeWidth={1.75} />
            Send to Agent
          </button>

          {/* Group button */}
          <button
            type="button"
            aria-label="Group selected nodes"
            className="glass-button"
            style={{
              height: 28,
              borderRadius: 8,
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
            onClick={handleGroup}
          >
            <Layers size={13} strokeWidth={1.75} />
            Group
          </button>

          {/* Close All button */}
          <button
            type="button"
            aria-label="Close all selected nodes"
            className="glass-button"
            style={{
              height: 28,
              borderRadius: 8,
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
            onClick={handleCloseAll}
          >
            Close All
          </button>

          {/* Clear selection × button */}
          <button
            type="button"
            aria-label="Clear selection"
            className="glass-button"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            onClick={handleClear}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </GlassPill>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
