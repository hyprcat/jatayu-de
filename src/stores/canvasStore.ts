import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// --- Types ---

export type NodeType = 'terminal' | 'browser' | 'webapp' | 'file' | 'note'

export interface CanvasNode {
  id: string
  type: NodeType
  title: string
  position: { x: number; y: number }
  size: { w: number; h: number }
  zIndex: number
  metadata: Record<string, unknown>
}

export interface NodeGroup {
  id: string
  name: string
  nodeIds: string[]
}

export interface CanvasMetadata {
  id: string
  name: string
  createdAt: number
  lastSavedAt: number
  nodeCount: number
}

// --- Store ---

interface CanvasState {
  activeCanvasId: string
  canvases: CanvasMetadata[]
  nodes: CanvasNode[]
  zoom: number
  panOffset: { x: number; y: number }
  selectedIds: Set<string>
  groups: NodeGroup[]
  snapToGrid: boolean
}

interface CanvasActions {
  addNode: (node: CanvasNode) => void
  removeNode: (id: string) => void
  updateNode: (id: string, updates: Partial<CanvasNode>) => void
  focusNode: (id: string) => void
  moveNode: (id: string, position: { x: number; y: number }) => void
  moveNodes: (ids: string[], offset: { dx: number; dy: number }) => void
  resizeNode: (id: string, size: { w: number; h: number }) => void
  setZoom: (zoom: number) => void
  setPanOffset: (offset: { x: number; y: number }) => void
  setSelectedIds: (ids: Set<string>) => void
  toggleSelectedId: (id: string) => void
  clearSelection: () => void
  setSnapToGrid: (snap: boolean) => void
  addGroup: (group: NodeGroup) => void
  removeGroup: (id: string) => void
  updateGroup: (id: string, updates: Partial<NodeGroup>) => void
  addNodeToGroup: (groupId: string, nodeId: string) => void
  removeNodeFromGroup: (groupId: string, nodeId: string) => void
  restoreCanvas: (nodes: CanvasNode[], zoom: number, panOffset: { x: number; y: number }, groups?: NodeGroup[]) => void
  setActiveCanvasId: (id: string) => void
  addCanvas: (canvas: CanvasMetadata) => void
  removeCanvas: (id: string) => void
  renameCanvas: (id: string, name: string) => void
  updateCanvasMetadata: (id: string, updates: Partial<CanvasMetadata>) => void
}

export type CanvasStore = CanvasState & CanvasActions

export const useCanvasStore = create<CanvasStore>()(
  persist(
    (set, get) => ({
      // State
      activeCanvasId: 'canvas-1',
      canvases: [
        {
          id: 'canvas-1',
          name: `Canvas — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          createdAt: Date.now(),
          lastSavedAt: Date.now(),
          nodeCount: 0,
        },
      ],
      nodes: [],
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      selectedIds: new Set<string>(),
      groups: [],
      snapToGrid: false,

      // Actions
      addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),

      removeNode: (id) =>
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== id),
          groups: state.groups.map((g) => ({
            ...g,
            nodeIds: g.nodeIds.filter((nid) => nid !== id),
          })),
        })),

      updateNode: (id, updates) =>
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
        })),

      focusNode: (id) =>
        set((state) => {
          const maxZ = Math.max(0, ...state.nodes.map((n) => n.zIndex))
          return {
            nodes: state.nodes.map((n) => (n.id === id ? { ...n, zIndex: maxZ + 1 } : n)),
          }
        }),

      moveNode: (id, position) =>
        set((state) => {
          const snap = state.snapToGrid
          const snapped = snap ? { x: Math.round(position.x / 24) * 24, y: Math.round(position.y / 24) * 24 } : position
          return {
            nodes: state.nodes.map((n) => (n.id === id ? { ...n, position: snapped } : n)),
          }
        }),

      moveNodes: (ids, offset) =>
        set((state) => {
          const idSet = new Set(ids)
          const snap = state.snapToGrid
          return {
            nodes: state.nodes.map((n) => {
              if (!idSet.has(n.id)) return n
              const newPos = { x: n.position.x + offset.dx, y: n.position.y + offset.dy }
              const snapped = snap ? { x: Math.round(newPos.x / 24) * 24, y: Math.round(newPos.y / 24) * 24 } : newPos
              return { ...n, position: snapped }
            }),
          }
        }),

      resizeNode: (id, size) =>
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === id ? { ...n, size } : n)),
        })),

      setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.25, zoom)) }),

      setPanOffset: (offset) => set({ panOffset: offset }),

      setSelectedIds: (ids) => set({ selectedIds: ids }),

      toggleSelectedId: (id) =>
        set((state) => {
          const next = new Set(state.selectedIds)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          return { selectedIds: next }
        }),

      clearSelection: () => set({ selectedIds: new Set<string>() }),

      setSnapToGrid: (snap) => set({ snapToGrid: snap }),

      addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),

      removeGroup: (id) =>
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
        })),

      updateGroup: (id, updates) =>
        set((state) => ({
          groups: state.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        })),

      addNodeToGroup: (groupId, nodeId) =>
        set((state) => ({
          groups: state.groups.map((g) => {
            if (g.id !== groupId) return g
            if (g.nodeIds.includes(nodeId)) return g
            return { ...g, nodeIds: [...g.nodeIds, nodeId] }
          }),
        })),

      removeNodeFromGroup: (groupId, nodeId) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, nodeIds: g.nodeIds.filter((nid) => nid !== nodeId) } : g,
          ),
        })),

      restoreCanvas: (nodes, zoom, panOffset, groups) =>
        set({
          nodes,
          zoom: Math.min(2, Math.max(0.25, zoom)),
          panOffset,
          selectedIds: new Set<string>(),
          groups: groups ?? [],
        }),

      setActiveCanvasId: (id) => set({ activeCanvasId: id }),

      addCanvas: (canvas) => set((state) => ({ canvases: [...state.canvases, canvas] })),

      removeCanvas: (id) =>
        set((state) => ({
          canvases: state.canvases.filter((c) => c.id !== id),
        })),

      renameCanvas: (id, name) =>
        set((state) => ({
          canvases: state.canvases.map((c) => (c.id === id ? { ...c, name } : c)),
        })),

      updateCanvasMetadata: (id, updates) =>
        set((state) => ({
          canvases: state.canvases.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        })),
    }),
    {
      name: 'flow-canvas-store',
      partialize: (state) => ({
        activeCanvasId: state.activeCanvasId,
        canvases: state.canvases,
        nodes: state.nodes,
        zoom: state.zoom,
        panOffset: state.panOffset,
        groups: state.groups,
        snapToGrid: state.snapToGrid,
      }),
    },
  ),
)

// --- Selectors ---

export const selectActiveCanvasId = (state: CanvasStore) => state.activeCanvasId
export const selectCanvases = (state: CanvasStore) => state.canvases
export const selectNodes = (state: CanvasStore) => state.nodes
export const selectZoom = (state: CanvasStore) => state.zoom
export const selectPanOffset = (state: CanvasStore) => state.panOffset
export const selectSelectedIds = (state: CanvasStore) => state.selectedIds
export const selectGroups = (state: CanvasStore) => state.groups
export const selectSnapToGrid = (state: CanvasStore) => state.snapToGrid
export const selectNodeById = (id: string) => (state: CanvasStore) => state.nodes.find((n) => n.id === id)
