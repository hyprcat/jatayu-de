import { useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, ArrowRight } from 'lucide-react'
import { GlassMenu } from '../glass'
import { useAgentStore, useUIStore } from '../../stores'
import type { AgentStatus } from '../../stores'

interface AgentsMenuDropdownProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLDivElement | null>
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  running: 'var(--accent-green)',
  idle: 'rgba(255,255,255,0.5)',
  waiting: 'var(--accent-orange)',
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  running: 'Running',
  idle: 'Idle',
  waiting: 'Waiting',
}

export function AgentsMenuDropdown({ open, onClose, anchorRef }: AgentsMenuDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const agents = useAgentStore((s) => s.agents)

  // Position dropdown below the anchor
  const posRef = useRef({ top: 0, left: 0 })

  useEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      posRef.current = { top: rect.bottom + 6, left: rect.left }
    }
  }, [open, anchorRef])

  // Close on Esc
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Close on click-outside
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [open, onClose, anchorRef])

  const handleAgentClick = useCallback(
    (agentId: string) => {
      useUIStore.getState().setActiveAgentId(agentId)
      useUIStore.getState().setAgentPanelOpen(true)
      onClose()
    },
    [onClose],
  )

  const handleSeeAll = useCallback(() => {
    useUIStore.getState().setAgentPanelOpen(true)
    onClose()
  }, [onClose])

  const handleCustomAgent = useCallback(() => {
    // Will open agent creation in a future story (Settings → Agents)
    onClose()
  }, [onClose])

  const handleOpenPanel = useCallback(() => {
    useUIStore.getState().setAgentPanelOpen(true)
    onClose()
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: posRef.current.top,
            left: posRef.current.left,
            zIndex: 2000,
          }}
        >
          <GlassMenu open={open} style={{ width: 280 }}>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 10px 6px',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Agents
              </span>
              <button
                type="button"
                onClick={handleSeeAll}
                aria-label="See all agents"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                See All <ArrowRight size={12} strokeWidth={1.75} />
              </button>
            </div>

            {/* Agent list */}
            <div
              style={{
                maxHeight: 5 * 40,
                overflowY: agents.length > 5 ? 'auto' : 'visible',
              }}
            >
              {agents.length === 0 ? (
                <div
                  style={{
                    padding: '12px 10px',
                    color: 'var(--text-tertiary)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    textAlign: 'center',
                  }}
                >
                  No agents configured
                </div>
              ) : (
                agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => handleAgentClick(agent.id)}
                    className="glass-button"
                    aria-label={`${agent.name} — ${STATUS_LABELS[agent.status]}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      height: 40,
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
                    {/* Colored circle */}
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: agent.color,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#fff',
                      }}
                    >
                      {agent.name.charAt(0).toUpperCase()}
                    </span>

                    {/* Name */}
                    <span
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {agent.name}
                    </span>

                    {/* Status dot + label */}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <motion.span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: STATUS_COLORS[agent.status],
                          flexShrink: 0,
                        }}
                        animate={agent.status === 'running' ? { opacity: [0.7, 1, 0.7] } : undefined}
                        transition={
                          agent.status === 'running' ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined
                        }
                      />
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                        {STATUS_LABELS[agent.status]}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                background: 'var(--glass-border)',
                opacity: 0.3,
                margin: '4px 0',
              }}
            />

            {/* + Custom Agent */}
            <button
              type="button"
              onClick={handleCustomAgent}
              className="glass-button"
              aria-label="Create custom agent"
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
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} strokeWidth={1.75} />
              Custom Agent
            </button>

            {/* Open Agent Panel */}
            <button
              type="button"
              onClick={handleOpenPanel}
              className="glass-button"
              aria-label="Open Agent Panel"
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
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              Open Agent Panel
              <ArrowRight size={14} strokeWidth={1.75} style={{ marginLeft: 'auto' }} />
            </button>
          </GlassMenu>
        </div>
      )}
    </AnimatePresence>
  )
}
