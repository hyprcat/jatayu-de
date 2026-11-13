import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore } from '../../stores'

// --- FPS measurement via rAF ---

function useFPS(): number {
  const [fps, setFps] = useState(60)
  const framesRef = useRef<number[]>([])

  useEffect(() => {
    let rafId: number

    const tick = (now: number) => {
      framesRef.current.push(now)
      // Keep last 60 frame timestamps
      if (framesRef.current.length > 60) framesRef.current.shift()

      if (framesRef.current.length >= 2) {
        const elapsed = framesRef.current[framesRef.current.length - 1] - framesRef.current[0]
        const count = framesRef.current.length - 1
        if (elapsed > 0) {
          setFps(Math.round((count / elapsed) * 1000))
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return fps
}

function getFPSColor(fps: number): string {
  if (fps >= 50) return 'var(--accent-green)'
  if (fps >= 30) return 'var(--accent-orange)'
  return 'var(--accent-red)'
}

function getFPSLabel(fps: number): string | null {
  if (fps >= 50) return null
  if (fps >= 30) return 'slow'
  return 'laggy'
}

// --- Performance Panel ---

function PerformancePanel({ onClose }: { onClose: () => void }) {
  const nodes = useCanvasStore((s) => s.nodes)
  const fps = useFPS()

  const terminalCount = nodes.filter((n) => n.type === 'terminal').length
  const browserCount = nodes.filter((n) => n.type === 'browser' || n.type === 'webapp').length

  // JS heap size (Chrome/Electron only)
  const perf = performance as unknown as {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number }
  }
  const heapUsed = perf.memory ? `${(perf.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)} MB` : 'N/A'
  const heapTotal = perf.memory ? `${(perf.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1)} MB` : 'N/A'

  // Close on Esc and click outside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-perf-panel]')) onClose()
    }
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', onClick)
    }, 0)
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const ROW: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-body)',
  }

  return createPortal(
    <motion.div
      data-perf-panel
      className="glass"
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', duration: 0.25 }}
      style={{
        position: 'fixed',
        bottom: 40,
        right: 16,
        width: 260,
        zIndex: 1100,
        borderRadius: 12,
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}
      >
        Performance
      </div>

      <div style={ROW}>
        <span style={{ color: 'var(--text-secondary)' }}>FPS</span>
        <span style={{ color: getFPSColor(fps), fontFamily: 'var(--font-mono)' }}>{fps}</span>
      </div>

      <div style={ROW}>
        <span style={{ color: 'var(--text-secondary)' }}>Nodes</span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{nodes.length}</span>
      </div>

      <div style={ROW}>
        <span style={{ color: 'var(--text-secondary)' }}>Terminal sessions</span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{terminalCount}</span>
      </div>

      <div style={ROW}>
        <span style={{ color: 'var(--text-secondary)' }}>Browser nodes</span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{browserCount}</span>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--glass-border)',
          marginTop: 6,
          paddingTop: 6,
        }}
      >
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>JS Heap (used)</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{heapUsed}</span>
        </div>
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>JS Heap (total)</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{heapTotal}</span>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--glass-border)',
          marginTop: 6,
          paddingTop: 6,
        }}
      >
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>Orbiter</span>
          <OrbiterStatusDot />
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}

function OrbiterStatusDot() {
  const [status, setStatus] = useState<string>('unknown')

  useEffect(() => {
    if (window.orbiter) {
      window.orbiter.status().then((s: unknown) => {
        const d = s as { status: string }
        setStatus(d.status ?? 'unknown')
      })
    }
  }, [])

  const color =
    status === 'running' ? 'var(--accent-green)' : status === 'error' ? 'var(--accent-red)' : 'var(--text-tertiary)'

  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-sm)',
        color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
        }}
      />
      {status}
    </span>
  )
}

// --- Performance Indicator (exported) ---

export function PerformanceIndicator() {
  const fps = useFPS()
  const [panelOpen, setPanelOpen] = useState(false)

  const color = getFPSColor(fps)
  const label = getFPSLabel(fps)

  const handleClick = useCallback(() => {
    setPanelOpen((o) => !o)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Performance: ${fps} FPS`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 6px',
          borderRadius: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        {label && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color,
            }}
          >
            {label}
          </span>
        )}
      </button>

      <AnimatePresence>{panelOpen && <PerformancePanel onClose={() => setPanelOpen(false)} />}</AnimatePresence>
    </>
  )
}
