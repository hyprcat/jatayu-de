import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, Eye, MapPin, Zap } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useUIStore, useCanvasStore } from '../../stores'
import type { Notification, NotificationToolCall } from '../../stores'
import { GlassPanel } from '../glass'

const MAX_VISIBLE = 3

// --- NotificationStack ---

export function NotificationStack() {
  const notifications = useUIStore((s) => s.notifications)
  const reducedMotion = useReducedMotion()

  // Visible = last MAX_VISIBLE (newest at bottom)
  const visible = notifications.slice(-MAX_VISIBLE)
  const overflowCount = Math.max(0, notifications.length - MAX_VISIBLE)

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
        alignItems: 'flex-end',
      }}
      aria-label="Notifications"
      role="log"
    >
      {/* Overflow pill — shows when there are more than MAX_VISIBLE */}
      <AnimatePresence>
        {overflowCount > 0 && (
          <motion.div
            key="overflow"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 8 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', duration: reducedMotion ? 0 : 0.25 }}
            style={{
              width: 340,
              borderRadius: 4,
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              position: 'relative',
              pointerEvents: 'auto',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -10,
                right: 8,
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
                background: 'var(--glass-bg)',
                padding: '0 4px',
                borderRadius: 4,
                lineHeight: 1,
              }}
            >
              +{overflowCount}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visible notification cards */}
      <AnimatePresence initial={false}>
        {visible.map((notif) => (
          <NotificationCard key={notif.id} notification={notif} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

// --- NotificationCard ---

function NotificationCard({ notification }: { notification: Notification }) {
  const removeNotification = useUIStore((s) => s.removeNotification)
  const decrementUnread = useUIStore((s) => s.decrementUnread)
  const setActiveAgentId = useUIStore((s) => s.setActiveAgentId)
  const setAgentPanelOpen = useUIStore((s) => s.setAgentPanelOpen)
  const setFocusedNodeId = useUIStore((s) => s.setFocusedNodeId)
  const reducedMotion = useReducedMotion()

  // Auto-dismiss countdown for system notifications
  const [countdown, setCountdown] = useState(5)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (notification.autoDismiss || notification.type === 'system') {
      // System notifications auto-dismiss after 5s
      setCountdown(5)
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            // Dismiss
            removeNotification(notification.id)
            decrementUnread()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
  }, [notification.id, notification.autoDismiss, notification.type, removeNotification, decrementUnread])

  const handleDismiss = useCallback(() => {
    removeNotification(notification.id)
    decrementUnread()
  }, [removeNotification, decrementUnread, notification.id])

  const handleViewResults = useCallback(() => {
    if (notification.agentId) {
      setActiveAgentId(notification.agentId)
      setAgentPanelOpen(true)
    }
    // Mark as read
    decrementUnread()
  }, [notification.agentId, setActiveAgentId, setAgentPanelOpen, decrementUnread])

  const handleJumpToNode = useCallback(() => {
    if (!notification.nodeId) return
    const store = useCanvasStore.getState()
    const node = store.nodes.find((n) => n.id === notification.nodeId)
    if (!node) return

    // Pan to center the node
    const zoom = store.zoom
    const panX = window.innerWidth / 2 - (node.position.x + node.size.w / 2) * zoom
    const panY = window.innerHeight / 2 - (node.position.y + node.size.h / 2) * zoom
    store.setPanOffset({ x: panX, y: panY })
    store.focusNode(node.id)
    setFocusedNodeId(node.id)
    decrementUnread()
  }, [notification.nodeId, setFocusedNodeId, decrementUnread])

  // Status dot color + pulsing
  const statusDot = notification.status ? getStatusDot(notification.status) : null

  // Elapsed time for background agent notifications with tool calls
  const elapsed =
    notification.startedAt && notification.toolCalls && notification.toolCalls.length > 0
      ? Date.now() - notification.startedAt
      : 0

  // Extract filename from filePath for artifact notifications
  const fileName = notification.filePath ? notification.filePath.split('/').pop() || notification.filePath : undefined

  return (
    <motion.div
      layout
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ x: '120%', opacity: 0, rotate: 2 }}
      transition={{
        layout: { type: 'spring', duration: reducedMotion ? 0 : 0.25 },
        y: { type: 'spring', duration: reducedMotion ? 0 : 0.35, bounce: 0.15 },
        x: { duration: reducedMotion ? 0 : 0.2, ease: 'easeIn' },
        opacity: { duration: reducedMotion ? 0 : 0.2 },
        rotate: { duration: reducedMotion ? 0 : 0.2 },
      }}
      style={{ pointerEvents: 'auto', width: 340 }}
    >
      <GlassPanel
        borderRadius={14}
        style={{
          padding: '12px 14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.20)',
        }}
      >
        {/* Header row: status dot + title + dismiss button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          {/* Status dot */}
          {statusDot}

          {/* Title */}
          <span
            style={{
              flex: 1,
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {notification.title}
          </span>

          {/* Auto-dismiss countdown for system notifications */}
          {(notification.autoDismiss || notification.type === 'system') && (
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
                flexShrink: 0,
              }}
            >
              {countdown}s
            </span>
          )}

          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
            className="glass-button"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              flexShrink: 0,
            }}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        {/* Message — 2 lines max */}
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            marginBottom: 8,
          }}
        >
          {notification.message}
        </div>

        {/* Compact tool call list for background agent notifications */}
        {notification.toolCalls && notification.toolCalls.length > 0 && (
          <CompactToolCallList toolCalls={notification.toolCalls} elapsed={elapsed} />
        )}

        {/* Artifact info: filename + type */}
        {notification.type === 'artifact' && fileName && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 6,
              marginBottom: 8,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileName}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Agent: View Results */}
          {notification.type === 'agent' && notification.agentId && notification.status !== 'running' && (
            <ActionButton
              icon={<Eye size={12} strokeWidth={1.75} />}
              label="View Results"
              onClick={handleViewResults}
            />
          )}

          {/* Artifact: Jump to Node */}
          {notification.type === 'artifact' && notification.nodeId && (
            <ActionButton
              icon={<MapPin size={12} strokeWidth={1.75} />}
              label="Jump to Node"
              onClick={handleJumpToNode}
            />
          )}
        </div>
      </GlassPanel>
    </motion.div>
  )
}

// --- Status dot ---

function getStatusDot(status: 'running' | 'done' | 'error'): React.ReactNode {
  if (status === 'running') {
    return (
      <motion.span
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--accent-green)',
          flexShrink: 0,
        }}
        aria-label="Running"
      />
    )
  }
  if (status === 'done') {
    return (
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--accent-green)',
          flexShrink: 0,
        }}
        aria-label="Done"
      />
    )
  }
  // error
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--accent-red)',
        flexShrink: 0,
      }}
      aria-label="Error"
    />
  )
}

// --- Compact tool call list for background agent notifications ---

function CompactToolCallList({ toolCalls, elapsed }: { toolCalls: NotificationToolCall[]; elapsed: number }) {
  const done = toolCalls.filter((t) => t.status !== 'running').length

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
        marginBottom: 8,
      }}
    >
      {toolCalls.map((tc) => (
        <div
          key={tc.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 0',
          }}
        >
          <Zap size={10} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {tc.toolName}
          </span>
          <span style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
            ({done}/{toolCalls.length} done)
          </span>
        </div>
      ))}
      <div
        style={{
          marginTop: 4,
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {toolCalls.length} tools called · {formatDuration(elapsed)}
      </div>
    </div>
  )
}

// --- Action button ---

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="glass-button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.04)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// --- Helpers ---

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const sec = (ms / 1000).toFixed(1)
  return `${sec}s`
}
