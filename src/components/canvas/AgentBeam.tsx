import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useCanvasStore, useUIStore, useAgentStore } from '../../stores'

const BEAM_VISIBLE_MS = 600
const BEAM_FADE_MS = 200

interface BeamLine {
  key: string
  agentColor: string
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * AgentBeam renders 1px SVG lines from agent glyphs (bottom-left pill)
 * to targeted canvas nodes. Visible for 600ms, then fades out over 200ms.
 */
export function AgentBeam() {
  const beams = useUIStore((s) => s.agentBeams)
  const agents = useAgentStore((s) => s.agents)
  const reducedMotion = useReducedMotion()
  const [lines, setLines] = useState<BeamLine[]>([])

  useEffect(() => {
    if (beams.length === 0) {
      setLines([])
      return
    }

    const computed: BeamLine[] = []
    const { nodes, zoom, panOffset } = useCanvasStore.getState()

    for (const beam of beams) {
      const node = nodes.find((n) => n.id === beam.nodeId)
      if (!node) continue

      const agent = agents.find((a) => a.id === beam.agentId)
      const agentColor = agent?.color ?? 'var(--text-tertiary)'

      // Target: node center in screen coordinates
      const nodeCenterX = node.position.x + node.size.w / 2
      const nodeCenterY = node.position.y + node.size.h / 2
      const screenX = nodeCenterX * zoom + panOffset.x
      const screenY = nodeCenterY * zoom + panOffset.y

      // Source: bottom-left pill area (approximate agent glyph position)
      // The bottom-left pill is at fixed position: left 16px, bottom 16px
      // Agent glyphs start after the Search button (~44px) + padding
      const agentIdx = agents.findIndex((a) => a.id === beam.agentId)
      const glyphX = 16 + 6 + 36 + 2 + (agentIdx >= 0 ? agentIdx : 0) * 22 + 10
      const glyphY = window.innerHeight - 16 - 22

      computed.push({
        key: `${beam.agentId}-${beam.nodeId}-${beam.timestamp}`,
        agentColor,
        x1: glyphX,
        y1: glyphY,
        x2: screenX,
        y2: screenY,
      })
    }

    setLines(computed)
  }, [beams, agents])

  // Auto-remove beams after BEAM_VISIBLE_MS
  useEffect(() => {
    if (beams.length === 0) return

    const timers: ReturnType<typeof setTimeout>[] = []
    for (const beam of beams) {
      const elapsed = Date.now() - beam.timestamp
      const remaining = Math.max(0, BEAM_VISIBLE_MS - elapsed)
      const timer = setTimeout(() => {
        useUIStore.getState().removeAgentBeam(beam.nodeId)
      }, remaining)
      timers.push(timer)
    }

    return () => timers.forEach(clearTimeout)
  }, [beams])

  if (lines.length === 0) return null

  return (
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 999,
      }}
    >
      <AnimatePresence>
        {lines.map((line) => (
          <motion.line
            key={line.key}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.agentColor}
            strokeWidth={1}
            strokeOpacity={0.3}
            initial={reducedMotion ? { opacity: 0.3 } : { opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : BEAM_FADE_MS / 1000 }}
          />
        ))}
      </AnimatePresence>
    </svg>
  )
}
