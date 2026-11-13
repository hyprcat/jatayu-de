import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore } from '../stores/uiStore'

/** Get the currently active canvas ID. */
function getActiveCanvasId(): string {
  return useCanvasStore.getState().activeCanvasId
}

export interface CanvasSnapshot {
  canvasId: string
  name: string
  timestamp: number
  nodes: Array<{
    id: string
    type: string
    title: string
    position: { x: number; y: number }
    size: { w: number; h: number }
    zIndex: number
    metadata: Record<string, unknown>
  }>
  zoom: number
  panOffset: { x: number; y: number }
  panelStates: Record<string, unknown>
  groups?: Array<{ id: string; name: string; nodeIds: string[] }>
}

export interface SnapshotListItem {
  name: string
  filePath: string
  timestamp: number
  nodeCount: number
  isAuto: boolean
}

/** Serialize current canvas state into a snapshot object. */
export function serializeCanvas(name: string): CanvasSnapshot {
  const { nodes, zoom, panOffset, groups, activeCanvasId } = useCanvasStore.getState()
  const ui = useUIStore.getState()

  return {
    canvasId: activeCanvasId,
    name,
    timestamp: Date.now(),
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      position: { ...n.position },
      size: { ...n.size },
      zIndex: n.zIndex,
      metadata: { ...n.metadata },
    })),
    zoom,
    panOffset: { ...panOffset },
    panelStates: {
      fileExplorerOpen: ui.fileExplorerOpen,
      agentPanelOpen: ui.agentPanelOpen,
    },
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      nodeIds: [...g.nodeIds],
    })),
  }
}

/** Save canvas snapshot to disk via IPC. Returns true on success. */
export async function saveCanvasSnapshot(name: string): Promise<boolean> {
  if (!window.electronAPI) return false

  const snapshot = serializeCanvas(name)
  const json = JSON.stringify(snapshot, null, 2)

  const result = (await window.electronAPI.invoke('canvas:save', snapshot.canvasId, name, json)) as {
    ok: boolean
    error?: string
  }

  return result.ok
}

/** List all snapshots for the current canvas. */
export async function listSnapshots(): Promise<SnapshotListItem[]> {
  if (!window.electronAPI) return []

  const result = (await window.electronAPI.invoke('canvas:listSnapshots', getActiveCanvasId())) as {
    ok: boolean
    snapshots?: SnapshotListItem[]
    error?: string
  }

  return result.ok ? (result.snapshots ?? []) : []
}

/** Load a snapshot from disk and restore canvas state. */
export async function loadSnapshot(filePath: string): Promise<boolean> {
  if (!window.electronAPI) return false

  const result = (await window.electronAPI.invoke('canvas:loadSnapshot', filePath)) as {
    ok: boolean
    data?: CanvasSnapshot
    error?: string
  }

  if (!result.ok || !result.data) return false

  const { nodes, zoom, panOffset, groups } = result.data

  // Restore canvas state — mark all nodes as materializing for staggered animation
  const restoredNodes = nodes.map((n, i) => ({
    ...n,
    type: n.type as 'terminal' | 'browser' | 'webapp' | 'file' | 'note',
    metadata: {
      ...n.metadata,
      materializing: true,
      materializeDelay: i * 50, // stagger by 50ms
    },
  }))

  useCanvasStore.getState().restoreCanvas(restoredNodes, zoom, panOffset, groups)

  return true
}

/** Save the current canvas state to its _state.json file via IPC. */
export async function saveCurrentCanvasState(): Promise<boolean> {
  if (!window.electronAPI) return false

  const canvasId = getActiveCanvasId()
  const snapshot = serializeCanvas('_state')
  const json = JSON.stringify(snapshot, null, 2)

  const result = (await window.electronAPI.invoke('canvas:save', canvasId, '_state', json)) as {
    ok: boolean
    error?: string
  }

  if (result.ok) {
    // Update canvas metadata
    useCanvasStore.getState().updateCanvasMetadata(canvasId, {
      lastSavedAt: Date.now(),
      nodeCount: snapshot.nodes.length,
    })
  }

  return result.ok
}

/** Load a canvas state from its _state.json file via IPC. Returns true if found and loaded. */
export async function loadCanvasState(canvasId: string): Promise<boolean> {
  if (!window.electronAPI) return false

  // List snapshots and find the _state snapshot
  const result = (await window.electronAPI.invoke('canvas:listSnapshots', canvasId)) as {
    ok: boolean
    snapshots?: SnapshotListItem[]
    error?: string
  }

  if (!result.ok || !result.snapshots) return false

  const stateSnapshot = result.snapshots.find((s) => s.name === '_state')
  if (!stateSnapshot) return false

  // Load the state snapshot (without materializing animation for canvas switch)
  const loadResult = (await window.electronAPI.invoke('canvas:loadSnapshot', stateSnapshot.filePath)) as {
    ok: boolean
    data?: CanvasSnapshot
    error?: string
  }

  if (!loadResult.ok || !loadResult.data) return false

  const { nodes, zoom, panOffset, groups } = loadResult.data
  const restoredNodes = nodes.map((n) => ({
    ...n,
    type: n.type as 'terminal' | 'browser' | 'webapp' | 'file' | 'note',
  }))

  useCanvasStore.getState().restoreCanvas(restoredNodes, zoom, panOffset, groups)
  return true
}

/** Switch to a different canvas: saves current state, loads target, updates activeCanvasId. */
export async function switchCanvas(targetCanvasId: string): Promise<boolean> {
  const store = useCanvasStore.getState()
  if (store.activeCanvasId === targetCanvasId) return true

  // Save current canvas state
  await saveCurrentCanvasState()

  // Load target canvas state
  const loaded = await loadCanvasState(targetCanvasId)

  if (!loaded) {
    // No saved state for this canvas — start with empty canvas
    store.restoreCanvas([], 1, { x: 0, y: 0 }, [])
  }

  // Update active canvas ID
  store.setActiveCanvasId(targetCanvasId)

  return true
}
