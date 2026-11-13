import { useEffect, useRef } from 'react'
import { MotionConfig, useReducedMotion } from 'framer-motion'
import { AppShell } from './components/layout/AppShell'
import { TopBar } from './components/chrome/TopBar'
import { TopLeftPill } from './components/chrome/TopLeftPill'
import { BottomLeftPill } from './components/chrome/BottomLeftPill'
import { FileExplorerPanel } from './components/chrome/FileExplorerPanel'
import { AgentChatPanel } from './components/chrome/AgentChatPanel'
import { NotificationStack } from './components/chrome/NotificationStack'
import { SelectionBar } from './components/chrome/SelectionBar'
import { Spotlight } from './components/chrome/Spotlight'
import { HistoryPanel } from './components/chrome/HistoryPanel'
import { SettingsPanel } from './components/chrome/SettingsPanel'
import { OnboardingFlow } from './components/chrome/OnboardingFlow'
import { PerformanceIndicator } from './components/chrome/PerformanceIndicator'
import { InfiniteCanvas } from './components/canvas/InfiniteCanvas'
import { AgentBeam } from './components/canvas/AgentBeam'
import { CanvasNodes, FileLightbox } from './components/nodes'
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts'
import { createNode } from './components/chrome/AddElementsDropdown'
import { buildCanvasContext } from './lib/canvasContext'
import { saveCanvasSnapshot } from './lib/canvasSave'
import { useUIStore, useAgentStore, useSettingsStore, useCanvasStore, conversationKey } from './stores'
import type { ToolCall } from './stores'

export default function App() {
  useCanvasShortcuts()

  const reducedMotion = useReducedMotion()
  const historyPanelOpen = useUIStore((s) => s.historyPanelOpen)

  // Sync high contrast mode to data-contrast attribute on html
  const highContrastMode = useSettingsStore((s) => s.highContrastMode)
  useEffect(() => {
    if (highContrastMode) {
      document.documentElement.setAttribute('data-contrast', 'high')
    } else {
      document.documentElement.removeAttribute('data-contrast')
    }
  }, [highContrastMode])

  // Sync document.title with active canvas name
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId)
  const canvases = useCanvasStore((s) => s.canvases)

  useEffect(() => {
    const canvas = canvases.find((c) => c.id === activeCanvasId)
    document.title = canvas ? `Flow — ${canvas.name}` : 'Flow'
  }, [activeCanvasId, canvases])

  // Listen for global Spotlight shortcut from Electron main process
  useEffect(() => {
    if (!window.electronAPI) return
    const handle = window.electronAPI.on('spotlight:toggle', () => {
      const ui = useUIStore.getState()
      ui.setSpotlightOpen(!ui.spotlightOpen)
    })
    return () => {
      window.electronAPI.off('spotlight:toggle', handle)
    }
  }, [])

  // Deep link: flow://canvas/[name] — switch to canvas by name
  useEffect(() => {
    if (!window.electronAPI) return
    const handle = window.electronAPI.on('deeplink:canvas', (name: unknown) => {
      const canvasName = String(name)
      const { canvases, setActiveCanvasId } = useCanvasStore.getState()
      const match = canvases.find((c) => c.name.toLowerCase() === canvasName.toLowerCase())
      if (match) setActiveCanvasId(match.id)
    })
    return () => {
      window.electronAPI.off('deeplink:canvas', handle)
    }
  }, [])

  // Deep link: flow://agent/[name]?prompt=[text] — open agent panel with prompt
  useEffect(() => {
    if (!window.electronAPI) return
    const handle = window.electronAPI.on('deeplink:agent', (name: unknown, prompt: unknown) => {
      const agentName = String(name)
      const agents = useAgentStore.getState().agents
      const match = agents.find((a) => a.name.toLowerCase() === agentName.toLowerCase())
      if (match) {
        const ui = useUIStore.getState()
        ui.setActiveAgentId(match.id)
        ui.setAgentPanelOpen(true)
      }
    })
    return () => {
      window.electronAPI.off('deeplink:agent', handle)
    }
  }, [])

  // Tray: Quick Note — create a note node
  useEffect(() => {
    if (!window.electronAPI) return
    const handle = window.electronAPI.on('tray:quick-note', () => {
      createNode('note', { title: 'Quick Note' })
    })
    return () => {
      window.electronAPI.off('tray:quick-note', handle)
    }
  }, [])

  // OS native file drag-and-drop onto the window
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }
    }
    const handleDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return
      e.preventDefault()
      const { zoom: z, panOffset: pan } = useCanvasStore.getState()
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i]
        const filePath = (file as unknown as { path?: string }).path
        if (!filePath) continue
        const worldX = (e.clientX - pan.x) / z + i * 30
        const worldY = (e.clientY - pan.y) / z + i * 30
        createNode('file', {
          filePath,
          title: file.name,
          positionOverride: { x: worldX, y: worldY },
        })
      }
    }
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  // Listen for Orbiter stream chunks (tool call events)
  useEffect(() => {
    if (!window.orbiter) return
    const handle = window.orbiter.onStreamChunk((data: unknown) => {
      const chunk = data as {
        type: string
        agentId?: string
        canvasId?: string
        toolCallId?: string
        toolName?: string
        args?: Record<string, unknown>
        output?: string
        error?: string
        summary?: string
        notificationId?: string
      }

      const agentId = chunk.agentId ?? useUIStore.getState().activeAgentId
      if (!agentId) return
      const canvasId = chunk.canvasId ?? useCanvasStore.getState().activeCanvasId
      const key = conversationKey(agentId, canvasId)

      if (chunk.type === 'tool_use') {
        // New tool call started — add as tool_call message
        const tcId = chunk.toolCallId ?? `tc-${Date.now()}`
        const toolName = chunk.toolName ?? 'unknown'
        const tc: ToolCall = {
          id: tcId,
          toolName,
          args: chunk.args ?? {},
          status: 'running',
          startedAt: Date.now(),
        }
        useAgentStore.getState().addMessage(key, {
          id: `msg-tc-${tc.id}`,
          role: 'tool_call',
          content: '',
          timestamp: Date.now(),
          toolCall: tc,
        })

        // Update background agent notification with tool call info
        const notifId = chunk.notificationId as string | undefined
        if (notifId) {
          const ui = useUIStore.getState()
          const notif = ui.notifications.find((n) => n.id === notifId)
          if (notif) {
            const tcs = [...(notif.toolCalls ?? []), { id: tcId, toolName, status: 'running' as const }]
            ui.updateNotification(notifId, { toolCalls: tcs })
          }
        }
      } else if (chunk.type === 'tool_result') {
        // Tool completed — update the existing tool call message
        const toolCallId = chunk.toolCallId
        if (!toolCallId) return
        useAgentStore.getState().updateToolCall(key, toolCallId, {
          status: chunk.error ? 'error' : 'success',
          output: chunk.output,
          error: chunk.error,
          summary: chunk.summary,
          completedAt: Date.now(),
        })

        // Update background agent notification tool call status
        const notifId = chunk.notificationId as string | undefined
        if (notifId) {
          const ui = useUIStore.getState()
          const notif = ui.notifications.find((n) => n.id === notifId)
          if (notif?.toolCalls) {
            const newStatus: 'error' | 'success' = chunk.error ? 'error' : 'success'
            const tcs = notif.toolCalls.map((t) => (t.id === toolCallId ? { ...t, status: newStatus } : t))
            ui.updateNotification(notifId, { toolCalls: tcs })
          }
        }
      }
    })
    return () => {
      window.orbiter.offStreamChunk(handle)
    }
  }, [])

  // Listen for Orbiter status events and create error notifications
  useEffect(() => {
    if (!window.orbiter) return
    const handle = window.orbiter.onStatus((data: unknown) => {
      const d = data as { status: string; error?: string }
      if (d.status === 'error') {
        const ui = useUIStore.getState()
        ui.addNotification({
          id: `orbiter-error-${Date.now()}`,
          type: 'system',
          title: 'Orbiter Error',
          message: d.error || 'Failed to start Orbiter. Check Orbiter Config in Settings.',
          status: 'error',
          timestamp: Date.now(),
        })
      }
    })
    return () => {
      window.orbiter.offStatus(handle)
    }
  }, [])

  // Listen for Orbiter artifact-created events — auto-create file node + notification
  useEffect(() => {
    if (!window.orbiter) return
    const handle = window.orbiter.onArtifactCreated((data: unknown) => {
      const d = data as { filePath: string; agentName?: string }
      if (!d.filePath) return

      const fileName = d.filePath.split('/').pop() || d.filePath
      // Create file node on canvas near viewport center with materializing flag
      const nodeId = createNode('file', {
        filePath: d.filePath,
        title: fileName,
        materializing: true,
      })

      // Show artifact notification with Jump to Node button
      useUIStore.getState().addNotification({
        id: `artifact-${Date.now()}`,
        type: 'artifact',
        title: d.agentName ? `Artifact from ${d.agentName}` : 'New Artifact',
        message: fileName,
        filePath: d.filePath,
        nodeId,
        timestamp: Date.now(),
      })
    })
    return () => {
      window.orbiter.offArtifactCreated(handle)
    }
  }, [])

  // Listen for Orbiter node-touch events — flash node + show agent beam
  useEffect(() => {
    if (!window.orbiter) return
    const handle = window.orbiter.onNodeTouch((data: unknown) => {
      const d = data as { nodeId?: string; agentId?: string }
      if (!d.nodeId) return

      const ui = useUIStore.getState()
      // Trigger node interaction flash
      ui.addNodeTouch(d.nodeId)

      // Show agent beam line from glyph to node
      if (d.agentId) {
        ui.addAgentBeam({
          agentId: d.agentId,
          nodeId: d.nodeId,
          timestamp: Date.now(),
        })
      }
    })
    return () => {
      window.orbiter.offNodeTouch(handle)
    }
  }, [])

  // Hint agent — background IPC call on configurable interval
  const hintIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!window.orbiter) return

    function startHintTimer() {
      const { canvasHintsEnabled, hintIntervalSec } = useSettingsStore.getState()
      if (!canvasHintsEnabled) return

      hintIntervalRef.current = setInterval(async () => {
        const { canvasHintsEnabled: enabled } = useSettingsStore.getState()
        if (!enabled) return

        try {
          const context = await buildCanvasContext()
          const result = (await window.orbiter.agent.run('hint_agent', '', context)) as {
            ok?: boolean
            result?: { hint?: string }
          }
          const hint = result?.result?.hint
          if (hint) {
            useUIStore.getState().addNotification({
              id: `hint-${Date.now()}`,
              type: 'system',
              title: 'Canvas Hint',
              message: hint,
              timestamp: Date.now(),
              autoDismiss: true,
            })
          }
        } catch {
          // Hint agent not available — silently ignore
        }
      }, hintIntervalSec * 1000)
    }

    startHintTimer()

    // Re-subscribe to settings changes for toggle/interval
    const unsub = useSettingsStore.subscribe((state, prevState) => {
      if (
        state.canvasHintsEnabled !== prevState.canvasHintsEnabled ||
        state.hintIntervalSec !== prevState.hintIntervalSec
      ) {
        if (hintIntervalRef.current) clearInterval(hintIntervalRef.current)
        hintIntervalRef.current = null
        startHintTimer()
      }
    })

    return () => {
      if (hintIntervalRef.current) clearInterval(hintIntervalRef.current)
      unsub()
    }
  }, [])

  // --- Auto-save canvas on interval ---
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    function startAutoSave() {
      const { autoSaveIntervalSec } = useSettingsStore.getState()
      autoSaveRef.current = setInterval(async () => {
        const ok = await saveCanvasSnapshot('auto')
        if (ok) {
          useUIStore.getState().addNotification({
            id: `autosave-${Date.now()}`,
            type: 'system',
            title: 'Canvas saved',
            message: 'Auto-save completed.',
            timestamp: Date.now(),
            autoDismiss: true,
          })
        }
      }, autoSaveIntervalSec * 1000)
    }

    startAutoSave()

    // Re-subscribe to settings changes for interval
    const unsub = useSettingsStore.subscribe((state, prevState) => {
      if (state.autoSaveIntervalSec !== prevState.autoSaveIntervalSec) {
        if (autoSaveRef.current) clearInterval(autoSaveRef.current)
        autoSaveRef.current = null
        startAutoSave()
      }
    })

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
      unsub()
    }
  }, [])

  return (
    <MotionConfig transition={reducedMotion ? { duration: 0 } : undefined}>
      <AppShell
        canvas={
          <InfiniteCanvas>
            <CanvasNodes />
          </InfiniteCanvas>
        }
        topBar={<TopBar />}
        topLeft={<TopLeftPill />}
        bottomLeft={<BottomLeftPill />}
        bottomRight={<PerformanceIndicator />}
      />
      <AgentBeam />
      <FileExplorerPanel />
      <AgentChatPanel />
      <NotificationStack />
      <SelectionBar />
      <FileLightbox />
      <Spotlight />
      <HistoryPanel open={historyPanelOpen} onClose={() => useUIStore.getState().setHistoryPanelOpen(false)} />
      <SettingsPanel />
      <OnboardingFlow />
    </MotionConfig>
  )
}
