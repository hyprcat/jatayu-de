import { motion, useReducedMotion } from 'framer-motion'
import { Search } from 'lucide-react'
import { GlassPill, GlassButton, Tooltip } from '../glass'
import { useUIStore, useAgentStore } from '../../stores'

const MAX_VISIBLE_GLYPHS = 5

export function BottomLeftPill() {
  const setSpotlightOpen = useUIStore((s) => s.setSpotlightOpen)
  const agents = useAgentStore((s) => s.agents)
  const reducedMotion = useReducedMotion()

  const visibleAgents = agents.slice(0, MAX_VISIBLE_GLYPHS)
  const overflowCount = Math.max(0, agents.length - MAX_VISIBLE_GLYPHS)

  const handleOpenSpotlight = () => {
    setSpotlightOpen(true)
  }

  return (
    <GlassPill style={{ height: 44, padding: '0 6px', gap: 2 }}>
      {/* Search — opens Spotlight */}
      <Tooltip label="Search (Super+Alt+Space)">
        <motion.div
          whileHover={reducedMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassButton aria-label="Open Spotlight search" onClick={handleOpenSpotlight}>
            <Search size={18} strokeWidth={1.75} />
          </GlassButton>
        </motion.div>
      </Tooltip>

      {/* Agent glyphs */}
      {visibleAgents.map((agent) => (
        <AgentGlyph key={agent.id} agent={agent} />
      ))}

      {/* Overflow badge */}
      {overflowCount > 0 && (
        <Tooltip label={`${overflowCount} more agent${overflowCount > 1 ? 's' : ''}`}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              flexShrink: 0,
              cursor: 'default',
            }}
          >
            +{overflowCount}
          </div>
        </Tooltip>
      )}
    </GlassPill>
  )
}

function AgentGlyph({
  agent,
}: {
  agent: { id: string; name: string; color: string; status: string; currentTask: string }
}) {
  const reducedMotion = useReducedMotion()
  const isRunning = agent.status === 'running'
  const initial = agent.name.charAt(0).toUpperCase()

  const statusLabel = agent.status === 'running' ? 'running' : agent.status === 'waiting' ? 'waiting' : 'idle'
  const tooltipText = agent.currentTask
    ? `${agent.name} (${statusLabel}) — ${agent.currentTask}`
    : `${agent.name} (${statusLabel})`

  const circle = (
    <motion.div
      animate={isRunning && !reducedMotion ? { opacity: [0.7, 1.0, 0.7] } : undefined}
      transition={isRunning && !reducedMotion ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      aria-label={`${agent.name} agent — ${statusLabel}`}
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: agent.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        cursor: 'default',
      }}
    >
      {initial}
    </motion.div>
  )

  return <Tooltip label={tooltipText}>{circle}</Tooltip>
}
