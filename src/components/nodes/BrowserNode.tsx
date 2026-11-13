import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { useCanvasStore } from '../../stores'
import type { CanvasNode } from '../../stores'

interface BrowserNodeProps {
  node: CanvasNode
}

export function BrowserNode({ node }: BrowserNodeProps) {
  const initialUrl = node.metadata.initialUrl as string | undefined
  const [hasNavigated, setHasNavigated] = useState(false)
  const [urlInput, setUrlInput] = useState(initialUrl || '')
  const [agentAction, setAgentAction] = useState<string | null>(null)
  const initializedRef = useRef(false)
  const agentActionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  // Compute screen bounds from world coords and send to main process
  const updateBounds = useCallback(() => {
    const { zoom, panOffset, nodes } = useCanvasStore.getState()
    const n = nodes.find((nd) => nd.id === node.id)
    if (!n) return

    const titleBarH = 33 // 32px title bar + 1px border-bottom
    const border = 1

    const screenX = n.position.x * zoom + panOffset.x + border * zoom
    const screenY = (n.position.y + titleBarH) * zoom + panOffset.y
    const screenW = (n.size.w - 2 * border) * zoom
    const screenH = (n.size.h - titleBarH - border) * zoom

    const vw = window.innerWidth
    const vh = window.innerHeight

    if (
      screenX + screenW < 0 ||
      screenY + screenH < 0 ||
      screenX > vw ||
      screenY > vh ||
      screenW <= 0 ||
      screenH <= 0
    ) {
      window.electronAPI.send('browser:setBounds', node.id, {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      })
    } else {
      window.electronAPI.send('browser:setBounds', node.id, {
        x: screenX,
        y: screenY,
        width: screenW,
        height: screenH,
      })
    }
  }, [node.id])

  // Throttled bounds update via rAF
  const scheduleBoundsUpdate = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      updateBounds()
    })
  }, [updateBounds])

  // Create WebContentsView on first navigation
  const handleNavigate = useCallback(
    async (url: string) => {
      if (!url.trim()) return

      const api = window.electronAPI

      if (!initializedRef.current) {
        initializedRef.current = true
        const result = (await api.invoke('browser:create', node.id)) as {
          ok: boolean
          cdpUrl?: string
        }
        if (result.cdpUrl) {
          const currentNode = useCanvasStore.getState().nodes.find((n) => n.id === node.id)
          useCanvasStore.getState().updateNode(node.id, {
            metadata: { ...currentNode?.metadata, cdpUrl: result.cdpUrl },
          })
        }
      }

      await api.invoke('browser:navigate', node.id, url)
      setHasNavigated(true)
      requestAnimationFrame(updateBounds)
    },
    [node.id, updateBounds],
  )

  // Auto-navigate if initialUrl is provided (e.g. from webapp external navigation)
  useEffect(() => {
    if (initialUrl && !hasNavigated && !initializedRef.current) {
      handleNavigate(initialUrl)
    }
  }, [initialUrl, hasNavigated, handleNavigate])

  // Subscribe to canvas store changes to update bounds
  useEffect(() => {
    if (!hasNavigated) return

    // Update immediately
    updateBounds()

    const unsub = useCanvasStore.subscribe(scheduleBoundsUpdate)
    window.addEventListener('resize', scheduleBoundsUpdate)

    return () => {
      unsub()
      window.removeEventListener('resize', scheduleBoundsUpdate)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [hasNavigated, updateBounds, scheduleBoundsUpdate])

  // Bring WebContentsView to front when node is focused
  useEffect(() => {
    if (!hasNavigated) return
    window.electronAPI.send('browser:focus', node.id)
  }, [node.zIndex, hasNavigated, node.id])

  // Listen for URL changes → update node title to domain
  useEffect(() => {
    const api = window.electronAPI

    const urlListener = api.on(`browser:url-updated:${node.id}`, (url: unknown) => {
      try {
        const urlObj = new URL(url as string)
        useCanvasStore.getState().updateNode(node.id, {
          title: urlObj.hostname,
        })
      } catch {
        // Invalid URL
      }
    })

    return () => {
      if (urlListener) api.off(`browser:url-updated:${node.id}`, urlListener)
    }
  }, [node.id])

  // Listen for agent action events (for floating label pill)
  useEffect(() => {
    const api = window.electronAPI

    const actionListener = api.on(`browser:agent-action:${node.id}`, (action: unknown) => {
      setAgentAction(action as string)
      if (agentActionTimer.current) clearTimeout(agentActionTimer.current)
      agentActionTimer.current = setTimeout(() => setAgentAction(null), 2000)
    })

    return () => {
      if (actionListener) api.off(`browser:agent-action:${node.id}`, actionListener)
      if (agentActionTimer.current) clearTimeout(agentActionTimer.current)
    }
  }, [node.id])

  // Destroy WebContentsView on unmount
  useEffect(() => {
    return () => {
      if (initializedRef.current) {
        window.electronAPI.invoke('browser:destroy', node.id).catch(() => {})
      }
    }
  }, [node.id])

  // Handle URL input submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleNavigate(urlInput)
  }

  // Start page (before navigation)
  if (!hasNavigated) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--node-bg)',
          padding: 32,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            maxWidth: 480,
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 12px',
              height: 40,
              borderRadius: 12,
              border: '1px solid var(--glass-border)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <Search size={16} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="Enter URL..."
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                outline: 'none',
              }}
              aria-label="Browser URL input"
            />
          </div>
        </form>
      </div>
    )
  }

  // After navigation: content area is covered by the native WebContentsView.
  // We render agent-related overlays here (they appear behind the native view
  // but serve as fallback UI / structure).
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'var(--node-bg)',
      }}
    >
      {/* Agent connected badge — shown in title bar area via NodeShell */}
      {/* Agent action floating label pill */}
      <AnimatePresence>
        {agentAction && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', duration: 0.25 }}
            style={{
              position: 'absolute',
              top: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}
          >
            <div
              className="glass-pill"
              style={{
                padding: '4px 12px',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-body)',
                color: 'var(--text-secondary)',
              }}
            >
              {agentAction}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
