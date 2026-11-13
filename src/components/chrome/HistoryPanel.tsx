import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, RotateCcw, X, Trash2 } from 'lucide-react'
import { GlassPanel, GlassButton } from '../glass'
import { useHistoryStore } from '../../stores'
import type { HistoryEntry } from '../../stores'
import { applyHistoryAction } from '../../lib/historyActions'

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

interface HistoryPanelProps {
  open: boolean
  onClose: () => void
}

export function HistoryPanel({ open, onClose }: HistoryPanelProps) {
  return createPortal(
    <AnimatePresence>{open && <HistoryPanelOverlay key="history-panel" onClose={onClose} />}</AnimatePresence>,
    document.body,
  )
}

function HistoryPanelOverlay({ onClose }: { onClose: () => void }) {
  const undoStack = useHistoryStore((s) => s.undoStack)
  const [, setTick] = useState(0)

  // Re-render timestamps every 10s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000)
    return () => clearInterval(interval)
  }, [])

  // Close on Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  // Revert to a specific point: undo everything after that entry
  const revertToEntry = useCallback((entryIndex: number) => {
    const store = useHistoryStore.getState()
    const stack = store.undoStack
    // Undo entries from the end down to entryIndex+1
    const count = stack.length - 1 - entryIndex
    for (let i = 0; i < count; i++) {
      const entry = useHistoryStore.getState().undo()
      if (entry) {
        applyHistoryAction(entry.undo)
      }
    }
  }, [])

  // Reverse chronological for display
  const entries = [...undoStack].reverse()

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0.1 }}
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        bottom: 16,
        width: 320,
        zIndex: 2000,
        pointerEvents: 'auto',
      }}
    >
      <GlassPanel
        borderRadius={14}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--glass-border)',
            flexShrink: 0,
          }}
        >
          <Clock size={16} strokeWidth={1.75} style={{ color: 'var(--text-secondary)' }} />
          <span
            style={{
              flex: 1,
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            History
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            {undoStack.length} actions
          </span>
          <GlassButton aria-label="Close history" onClick={onClose}>
            <X size={14} strokeWidth={1.75} />
          </GlassButton>
        </div>

        {/* Entries */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {entries.length === 0 && (
            <div
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
              }}
            >
              No history yet
            </div>
          )}

          {entries.map((entry, displayIndex) => {
            const realIndex = undoStack.length - 1 - displayIndex
            return <HistoryEntryRow key={entry.id} entry={entry} onRevert={() => revertToEntry(realIndex)} />
          })}
        </div>

        {/* Footer */}
        {undoStack.length > 0 && (
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--glass-border)',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => useHistoryStore.getState().clear()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                padding: '6px 8px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
              }}
              className="glass-button"
              aria-label="Clear history"
            >
              <Trash2 size={12} strokeWidth={1.75} />
              Clear History
            </button>
          </div>
        )}
      </GlassPanel>
    </motion.div>
  )
}

function HistoryEntryRow({ entry, onRevert }: { entry: HistoryEntry; onRevert: () => void }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 8,
        background: isHovered ? 'var(--glass-hover)' : 'transparent',
        transition: 'background 100ms',
        cursor: 'pointer',
      }}
      onClick={onRevert}
      role="button"
      aria-label={`Revert to: ${entry.description}`}
    >
      <RotateCcw
        size={12}
        strokeWidth={1.75}
        style={{
          color: 'var(--text-tertiary)',
          opacity: isHovered ? 1 : 0.5,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.description}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      >
        {timeAgo(entry.timestamp)}
      </span>
    </div>
  )
}
