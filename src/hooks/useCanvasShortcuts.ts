import { useEffect } from 'react'
import { createNode, duplicateNode } from '../components/chrome/AddElementsDropdown'
import { useCanvasStore, useUIStore, useAgentStore, useHistoryStore, useSettingsStore } from '../stores'
import { executeUndo, executeRedo } from '../lib/historyActions'

const URL_REGEX = /^https?:\/\//i
const PATH_REGEX = /^[~/]/

/** Smart paste: read clipboard and create appropriate node. */
async function handleSmartPaste() {
  if (!window.electronAPI) {
    // Fallback: read from navigator clipboard
    try {
      const text = await navigator.clipboard.readText()
      if (text) routeClipboardText(text)
    } catch {
      /* clipboard not available */
    }
    return
  }

  // Check for image first
  const hasImage = (await window.electronAPI.invoke('clipboard:hasImage')) as boolean
  if (hasImage) {
    const workspaceDir = useSettingsStore.getState().workspaceDir
    const destDir = `${workspaceDir}/clipboard`
    const filePath = (await window.electronAPI.invoke('clipboard:saveImage', destDir)) as string | null
    if (filePath) {
      createNode('file', { filePath, title: filePath.split('/').pop() || 'clipboard.png' })
    }
    return
  }

  // Read text
  const text = (await window.electronAPI.invoke('clipboard:readText')) as string
  if (text) routeClipboardText(text.trim())
}

function routeClipboardText(text: string) {
  if (URL_REGEX.test(text)) {
    // URL → browser node
    createNode('browser', { initialUrl: text, title: new URL(text).hostname })
  } else if (PATH_REGEX.test(text)) {
    // File path → file node
    createNode('file', { filePath: text, title: text.split('/').pop() || text })
  } else {
    // Plain text → note node
    createNode('note', { noteContent: text, title: 'Quick Note' })
  }
}

/** Remove a node and push to undo history. */
export function removeNodeWithHistory(id: string) {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === id)
  if (!node) return
  const snapshot = { ...node, metadata: { ...node.metadata } }
  useCanvasStore.getState().removeNode(id)
  useHistoryStore.getState().pushAction({
    id: `h-${Date.now()}-remove-${id}`,
    type: 'removeNode',
    timestamp: Date.now(),
    description: `Remove ${snapshot.type} "${snapshot.title}"`,
    undo: { type: 'removeNode', nodeId: id, node: snapshot },
    redo: { type: 'removeNode', nodeId: id },
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Zoom toward the viewport center, clamped to 25%–200%. */
function zoomToCenter(newZoom: number) {
  const { zoom, panOffset, setZoom, setPanOffset } = useCanvasStore.getState()
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const wx = (cx - panOffset.x) / zoom
  const wy = (cy - panOffset.y) / zoom
  const clamped = clamp(newZoom, 0.25, 2)
  setZoom(clamped)
  setPanOffset({ x: cx - wx * clamped, y: cy - wy * clamped })
}

/** Check if event target is an interactive element that should absorb keyboard input. */
function isInteractive(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return false
}

/** Get sorted node IDs (by numeric portion of ID for stable ordering). */
function getSortedNodeIds(): string[] {
  const { nodes } = useCanvasStore.getState()
  return nodes
    .map((n) => n.id)
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, '')) || 0
      const nb = parseInt(b.replace(/\D/g, '')) || 0
      return na - nb
    })
}

/**
 * All keyboard shortcuts for the Flow app.
 *
 * Three focus layers: canvas | node | panel
 * - Canvas: Tab/Shift+Tab cycles nodes, 1-9 jump to node, Arrows pan
 * - Node: Enter activates, Esc deactivates, Arrows move, ⌘Enter context menu
 * - Panel: ↑↓ navigate items, Enter opens, Esc closes panel
 *
 * Global shortcuts active in all layers:
 * Super+Alt+Space=Spotlight (main process), ⌘T/B/O=add nodes, ⌘S=save,
 * ⌘Z/⌘⇧Z=undo/redo, ⌘⇧E/A=toggle panels, ⌘⇧G=snap grid, ⌘⇧F=Spotlight fw:
 */
export function useCanvasShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const ui = useUIStore.getState()
      const { focusLayer, focusedNodeId, nodeActivated } = ui

      // If a node is activated (content focused, e.g. terminal),
      // only intercept Esc and global shortcuts — let content handle the rest
      if (nodeActivated) {
        if (e.key === 'Escape') {
          e.preventDefault()
          ui.setNodeActivated(false)
          window.dispatchEvent(new CustomEvent('flow:node-deactivate', { detail: { nodeId: focusedNodeId } }))
          return
        }
        // Still handle global shortcuts even when node is activated
        if (handleGlobalShortcuts(e, mod)) return
        // Let the activated node content handle all other keys
        return
      }

      // --- Esc: ordered overlay dismissal ---
      if (e.key === 'Escape' && !mod) {
        if (handleEscDismissal(e)) return
      }

      // --- Global shortcuts (always active) ---
      if (handleGlobalShortcuts(e, mod)) return

      // Skip layer-specific shortcuts when target is an interactive element
      if (isInteractive(e.target)) return

      // --- Layer-specific shortcuts ---
      switch (focusLayer) {
        case 'canvas':
          handleCanvasLayer(e, mod)
          break
        case 'node':
          handleNodeLayer(e, mod)
          break
        case 'panel':
          handlePanelLayer(e, mod)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}

// ─── Esc Ordered Dismissal ───

function handleEscDismissal(e: KeyboardEvent): boolean {
  const ui = useUIStore.getState()

  // 1. Spotlight
  if (ui.spotlightOpen) {
    // Spotlight handles its own Esc — don't interfere
    return false
  }

  // 2. Settings
  if (ui.settingsOpen) {
    e.preventDefault()
    ui.setSettingsOpen(false)
    return true
  }

  // 3. Lightbox
  if (ui.lightboxNodeId) {
    // FileLightbox handles its own Esc — don't interfere
    return false
  }

  // 4. History panel
  if (ui.historyPanelOpen) {
    e.preventDefault()
    ui.setHistoryPanelOpen(false)
    return true
  }

  // 5. Save dialog
  if (ui.saveDialogOpen) {
    // SaveSnapshotDialog handles its own Esc
    return false
  }

  // 5. Panel
  if (ui.focusLayer === 'panel') {
    e.preventDefault()
    // Close whichever panel is open
    if (ui.fileExplorerOpen) ui.setFileExplorerOpen(false)
    if (ui.agentPanelOpen) ui.setAgentPanelOpen(false)
    ui.setFocusLayer('canvas')
    return true
  }

  // 6. Node focus → unfocus node
  if (ui.focusedNodeId) {
    e.preventDefault()
    ui.setFocusedNodeId(null)
    ui.setFocusLayer('canvas')
    return true
  }

  // 7. Clear selection
  const { selectedIds, clearSelection } = useCanvasStore.getState()
  if (selectedIds.size > 0) {
    e.preventDefault()
    clearSelection()
    return true
  }

  return false
}

// ─── Global Shortcuts (always active) ───

function handleGlobalShortcuts(e: KeyboardEvent, mod: boolean): boolean {
  // ⌘T: new terminal
  if (mod && e.key === 't') {
    e.preventDefault()
    createNode('terminal')
    return true
  }

  // ⌘B: new browser
  if (mod && e.key === 'b') {
    e.preventDefault()
    createNode('browser')
    return true
  }

  // ⌘O: open file
  if (mod && e.key === 'o') {
    e.preventDefault()
    if (window.electronAPI) {
      window.electronAPI.invoke('dialog:openFile').then((filePath) => {
        if (filePath) createNode('file', { filePath })
      })
    } else {
      createNode('file')
    }
    return true
  }

  // ⌘S: save canvas
  if (mod && e.key === 's') {
    e.preventDefault()
    useUIStore.getState().setSaveDialogOpen(true)
    return true
  }

  // ⌘Z: undo
  if (mod && !e.shiftKey && e.key === 'z') {
    e.preventDefault()
    executeUndo()
    return true
  }

  // ⌘⇧Z: redo
  if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    executeRedo()
    return true
  }

  // ⌘V: smart paste — only when no node is focused (focused node gets native paste)
  if (mod && e.key === 'v' && !useUIStore.getState().focusedNodeId) {
    e.preventDefault()
    handleSmartPaste()
    return true
  }

  // ⌘⇧E: toggle file explorer
  if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
    e.preventDefault()
    const ui = useUIStore.getState()
    const opening = !ui.fileExplorerOpen
    ui.setFileExplorerOpen(opening)
    if (opening) {
      ui.setFocusLayer('panel')
    } else if (ui.focusLayer === 'panel') {
      ui.setFocusLayer('canvas')
    }
    return true
  }

  // ⌘⇧A: toggle agent panel or send selection
  if (mod && e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    const { selectedIds, nodes, activeCanvasId, clearSelection } = useCanvasStore.getState()
    const ui = useUIStore.getState()

    if (selectedIds.size > 0) {
      // Send selection to agent panel
      const selectedNodes = nodes.filter((n) => selectedIds.has(n.id))
      const agentId = ui.activeAgentId ?? useAgentStore.getState().agents[0]?.id
      if (agentId) {
        const contextLines: string[] = [`--- ${selectedNodes.length} nodes selected ---`]
        for (const n of selectedNodes) {
          contextLines.push(`[${n.id}] ${n.type}: ${n.title}`)
        }
        const key = `${agentId}:${activeCanvasId}`
        useAgentStore.getState().addMessage(key, {
          id: `msg-ctx-${Date.now()}`,
          role: 'user',
          content: contextLines.join('\n'),
          timestamp: Date.now(),
        })
        ui.setActiveAgentId(agentId)
        ui.setAgentPanelOpen(true)
        ui.setFocusLayer('panel')
        clearSelection()
      }
    } else {
      const opening = !ui.agentPanelOpen
      ui.setAgentPanelOpen(opening)
      if (opening) {
        ui.setFocusLayer('panel')
      } else if (ui.focusLayer === 'panel') {
        ui.setFocusLayer('canvas')
      }
    }
    return true
  }

  // ⌘⇧G: toggle snap-to-grid
  if (mod && e.shiftKey && e.key.toLowerCase() === 'g') {
    e.preventDefault()
    const { snapToGrid, setSnapToGrid } = useCanvasStore.getState()
    setSnapToGrid(!snapToGrid)
    return true
  }

  // ⌘⇧F: open Spotlight with fw: prefix
  if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault()
    const ui = useUIStore.getState()
    ui.setSpotlightOpen(true)
    // Dispatch event to pre-fill Spotlight input with 'fw: '
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('flow:spotlight-prefill', { detail: { text: 'fw: ' } }))
    })
    return true
  }

  // Zoom: ⌘+/⌘-/⌘0
  if (mod && (e.key === '=' || e.key === '+')) {
    e.preventDefault()
    const { zoom } = useCanvasStore.getState()
    zoomToCenter(zoom * 1.2)
    return true
  }
  if (mod && e.key === '-') {
    e.preventDefault()
    const { zoom } = useCanvasStore.getState()
    zoomToCenter(zoom / 1.2)
    return true
  }
  if (mod && e.key === '0') {
    e.preventDefault()
    zoomToCenter(1)
    return true
  }

  return false
}

// ─── Canvas Layer ───

function handleCanvasLayer(e: KeyboardEvent, mod: boolean) {
  const ui = useUIStore.getState()

  // Tab / Shift+Tab: cycle focused node by window ID
  if (e.key === 'Tab') {
    e.preventDefault()
    const ids = getSortedNodeIds()
    if (ids.length === 0) return

    const currentIdx = ui.focusedNodeId ? ids.indexOf(ui.focusedNodeId) : -1
    let nextIdx: number

    if (e.shiftKey) {
      nextIdx = currentIdx <= 0 ? ids.length - 1 : currentIdx - 1
    } else {
      nextIdx = currentIdx >= ids.length - 1 ? 0 : currentIdx + 1
    }

    const nextId = ids[nextIdx]
    useCanvasStore.getState().focusNode(nextId)
    ui.setFocusedNodeId(nextId)
    ui.setFocusLayer('node')
    return
  }

  // 1-9: jump to node by window ID number
  if (!mod && !e.shiftKey && e.key >= '1' && e.key <= '9') {
    const { nodes } = useCanvasStore.getState()
    const targetNode = nodes.find((n) => {
      const num = parseInt(n.id.replace(/\D/g, '')) || 0
      return num === parseInt(e.key)
    })
    if (targetNode) {
      e.preventDefault()
      useCanvasStore.getState().focusNode(targetNode.id)
      ui.setFocusedNodeId(targetNode.id)
      ui.setFocusLayer('node')
    }
    return
  }

  // ⌘A: select all nodes
  if (mod && !e.shiftKey && e.key === 'a') {
    e.preventDefault()
    const { nodes, setSelectedIds } = useCanvasStore.getState()
    setSelectedIds(new Set(nodes.map((n) => n.id)))
    return
  }

  // Arrow keys: pan canvas 40px (Shift=120px)
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !mod) {
    e.preventDefault()
    const step = e.shiftKey ? 120 : 40
    const { panOffset, setPanOffset } = useCanvasStore.getState()
    switch (e.key) {
      case 'ArrowUp':
        setPanOffset({ x: panOffset.x, y: panOffset.y + step })
        break
      case 'ArrowDown':
        setPanOffset({ x: panOffset.x, y: panOffset.y - step })
        break
      case 'ArrowLeft':
        setPanOffset({ x: panOffset.x + step, y: panOffset.y })
        break
      case 'ArrowRight':
        setPanOffset({ x: panOffset.x - step, y: panOffset.y })
        break
    }
    return
  }
}

// ─── Node Focus Layer ───

function handleNodeLayer(e: KeyboardEvent, mod: boolean) {
  const ui = useUIStore.getState()
  const focusedId = ui.focusedNodeId
  if (!focusedId) {
    // No focused node — fall back to canvas layer
    ui.setFocusLayer('canvas')
    return
  }

  // Enter: activate node (enter content — e.g. focus terminal)
  if (e.key === 'Enter' && !mod) {
    e.preventDefault()
    ui.setNodeActivated(true)
    window.dispatchEvent(new CustomEvent('flow:node-activate', { detail: { nodeId: focusedId } }))
    return
  }

  // ⌘Enter: open context menu for focused node
  if (e.key === 'Enter' && mod) {
    e.preventDefault()
    const node = useCanvasStore.getState().nodes.find((n) => n.id === focusedId)
    if (node) {
      // Calculate screen position for context menu (center of node)
      const { zoom, panOffset } = useCanvasStore.getState()
      const screenX = node.position.x * zoom + panOffset.x + (node.size.w * zoom) / 2
      const screenY = node.position.y * zoom + panOffset.y + 32 * zoom
      window.dispatchEvent(
        new CustomEvent('flow:node-context-menu', {
          detail: { nodeId: focusedId, x: screenX, y: screenY },
        }),
      )
    }
    return
  }

  // F2: rename
  if (e.key === 'F2' && !mod) {
    e.preventDefault()
    ui.setRenamingNodeId(focusedId)
    return
  }

  // ⌘W: close focused node
  if (mod && e.key === 'w') {
    e.preventDefault()
    removeNodeWithHistory(focusedId)
    ui.setFocusedNodeId(null)
    ui.setFocusLayer('canvas')
    return
  }

  // ⌘D: duplicate focused node
  if (mod && e.key === 'd') {
    e.preventDefault()
    duplicateNode(focusedId)
    return
  }

  // Delete / Backspace: close node (with confirm if has unsaved state)
  if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
    e.preventDefault()
    const node = useCanvasStore.getState().nodes.find((n) => n.id === focusedId)
    if (!node) return
    // Confirm for terminals (active sessions) and edited files
    const needsConfirm = node.type === 'terminal' || node.type === 'browser' || node.type === 'webapp'
    if (needsConfirm) {
      const ok = window.confirm(`Close "${node.title}"? Any unsaved state will be lost.`)
      if (!ok) return
    }
    removeNodeWithHistory(focusedId)
    ui.setFocusedNodeId(null)
    ui.setFocusLayer('canvas')
    return
  }

  // Arrow keys: move focused node 10px (Shift=40px)
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !mod) {
    e.preventDefault()
    const step = e.shiftKey ? 40 : 10
    const node = useCanvasStore.getState().nodes.find((n) => n.id === focusedId)
    if (!node) return
    const newPos = { ...node.position }
    switch (e.key) {
      case 'ArrowUp':
        newPos.y -= step
        break
      case 'ArrowDown':
        newPos.y += step
        break
      case 'ArrowLeft':
        newPos.x -= step
        break
      case 'ArrowRight':
        newPos.x += step
        break
    }
    useCanvasStore.getState().moveNode(focusedId, newPos)
    return
  }

  // ⌘A: select all nodes (global behavior)
  if (mod && !e.shiftKey && e.key === 'a') {
    e.preventDefault()
    const { nodes, setSelectedIds } = useCanvasStore.getState()
    setSelectedIds(new Set(nodes.map((n) => n.id)))
    return
  }

  // ⌘. : send focused node to active agent
  if (mod && e.key === '.') {
    e.preventDefault()
    const node = useCanvasStore.getState().nodes.find((n) => n.id === focusedId)
    if (!node) return
    const agentId = ui.activeAgentId ?? useAgentStore.getState().agents[0]?.id
    if (!agentId) return
    const canvasId = useCanvasStore.getState().activeCanvasId
    const key = `${agentId}:${canvasId}`
    useAgentStore.getState().addMessage(key, {
      id: `msg-ctx-${Date.now()}`,
      role: 'user',
      content: `--- Node context ---\n[${node.id}] ${node.type}: ${node.title}`,
      timestamp: Date.now(),
    })
    ui.setActiveAgentId(agentId)
    ui.setAgentPanelOpen(true)
    return
  }

  // ⌘/ : open agent panel with agent picker
  if (mod && e.key === '/') {
    e.preventDefault()
    ui.setAgentPanelOpen(true)
    ui.setFocusLayer('panel')
    return
  }

  // Tab / Shift+Tab: cycle to next/prev node (same as canvas layer)
  if (e.key === 'Tab') {
    e.preventDefault()
    const ids = getSortedNodeIds()
    if (ids.length === 0) return
    const currentIdx = ids.indexOf(focusedId)
    let nextIdx: number
    if (e.shiftKey) {
      nextIdx = currentIdx <= 0 ? ids.length - 1 : currentIdx - 1
    } else {
      nextIdx = currentIdx >= ids.length - 1 ? 0 : currentIdx + 1
    }
    const nextId = ids[nextIdx]
    useCanvasStore.getState().focusNode(nextId)
    ui.setFocusedNodeId(nextId)
    return
  }
}

// ─── Panel Focus Layer ───

function handlePanelLayer(e: KeyboardEvent, mod: boolean) {
  // Panel-specific shortcuts are handled by the panels themselves
  // (FileExplorerPanel and AgentChatPanel have their own keydown handlers)

  // ⌘W: close focused node if one exists
  if (mod && e.key === 'w') {
    const focusedId = useUIStore.getState().focusedNodeId
    if (focusedId) {
      e.preventDefault()
      removeNodeWithHistory(focusedId)
      useUIStore.getState().setFocusedNodeId(null)
    }
    return
  }

  // ⌘D: duplicate focused node
  if (mod && e.key === 'd') {
    const focusedId = useUIStore.getState().focusedNodeId
    if (focusedId) {
      e.preventDefault()
      duplicateNode(focusedId)
    }
    return
  }

  // ⌘A: select all nodes
  if (mod && !e.shiftKey && e.key === 'a') {
    e.preventDefault()
    const { nodes, setSelectedIds } = useCanvasStore.getState()
    setSelectedIds(new Set(nodes.map((n) => n.id)))
    return
  }
}
