import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, RotateCcw } from 'lucide-react'
import { GlassPanel } from '../glass'
import { listSnapshots, loadSnapshot, type SnapshotListItem } from '../../lib/canvasSave'
import { useUIStore } from '../../stores'

interface RestoreMenuProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function RestoreMenu({ open, onClose, anchorRef }: RestoreMenuProps) {
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([])
  const [loading, setLoading] = useState(false)
  const posRef = useRef({ x: 0, y: 0 })

  // Load snapshot list when menu opens
  useEffect(() => {
    if (!open) return
    // Capture anchor position
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      posRef.current = { x: rect.left, y: rect.bottom + 8 }
    }
    setLoading(true)
    listSnapshots().then((items) => {
      setSnapshots(items)
      setLoading(false)
    })
  }, [open, anchorRef])

  // Close on Esc
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Click outside
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('[data-restore-menu]')) {
          onClose()
        }
      }
      window.addEventListener('mousedown', handler)
      return () => window.removeEventListener('mousedown', handler)
    }, 0)
    // Return cleanup for the outer timeout — actual listener cleanup handled inside
    let cleanup: (() => void) | undefined
    const outerTimer = setTimeout(() => {
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('[data-restore-menu]')) {
          onClose()
        }
      }
      window.addEventListener('mousedown', handler)
      cleanup = () => window.removeEventListener('mousedown', handler)
    }, 0)
    return () => {
      clearTimeout(outerTimer)
      clearTimeout(t)
      cleanup?.()
    }
  }, [open, onClose])

  const handleRestore = useCallback(
    async (snapshot: SnapshotListItem) => {
      onClose()
      const ok = await loadSnapshot(snapshot.filePath)
      if (ok) {
        useUIStore.getState().addNotification({
          id: `restore-${Date.now()}`,
          type: 'system',
          title: 'Canvas Restored',
          message: `Restored "${snapshot.name}"`,
          timestamp: Date.now(),
          autoDismiss: true,
        })
      } else {
        useUIStore.getState().addNotification({
          id: `restore-err-${Date.now()}`,
          type: 'system',
          title: 'Restore Failed',
          message: 'Could not load snapshot.',
          status: 'error',
          timestamp: Date.now(),
        })
      }
    },
    [onClose],
  )

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="restore-menu"
          data-restore-menu
          initial={{ opacity: 0, scale: 0.97, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -4 }}
          transition={{ type: 'spring', duration: 0.2 }}
          style={{
            position: 'fixed',
            left: posRef.current.x,
            top: posRef.current.y,
            zIndex: 3000,
          }}
        >
          <GlassPanel
            borderRadius={14}
            style={{
              width: 320,
              maxHeight: 400,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '10px 14px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <RotateCcw size={14} strokeWidth={1.75} />
              Restore Snapshot
            </div>

            {/* List */}
            <div
              style={{
                overflowY: 'auto',
                maxHeight: 340,
                padding: '4px 0',
              }}
            >
              {loading && (
                <div
                  style={{
                    padding: '16px 14px',
                    color: 'var(--text-tertiary)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    textAlign: 'center',
                  }}
                >
                  Loading snapshots…
                </div>
              )}

              {!loading && snapshots.length === 0 && (
                <div
                  style={{
                    padding: '16px 14px',
                    color: 'var(--text-tertiary)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    textAlign: 'center',
                  }}
                >
                  No snapshots yet. Save one with ⌘S.
                </div>
              )}

              {!loading &&
                snapshots.map((snap) => (
                  <button
                    key={snap.filePath}
                    type="button"
                    onClick={() => handleRestore(snap)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 14px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = 'var(--glass-hover)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                  >
                    <Clock
                      size={14}
                      strokeWidth={1.75}
                      style={{
                        color: snap.isAuto ? 'var(--text-tertiary)' : 'var(--accent-blue)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: 'var(--text-primary)',
                          fontSize: 'var(--text-sm)',
                          fontFamily: 'var(--font-body)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {snap.isAuto ? 'Auto-save' : snap.name}
                      </div>
                      <div
                        style={{
                          color: 'var(--text-tertiary)',
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: 2,
                        }}
                      >
                        {timeAgo(snap.timestamp)} · {snap.nodeCount} node
                        {snap.nodeCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
