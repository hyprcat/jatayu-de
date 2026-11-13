import { create } from 'zustand'

// --- Types ---

export interface NotificationToolCall {
  id: string
  toolName: string
  status: 'running' | 'success' | 'error'
}

export interface Notification {
  id: string
  type: 'agent' | 'system' | 'artifact'
  title: string
  message: string
  status?: 'running' | 'done' | 'error'
  agentId?: string
  filePath?: string
  nodeId?: string
  timestamp: number
  autoDismiss?: boolean
  toolCalls?: NotificationToolCall[]
  startedAt?: number
}

export interface AgentBeamTarget {
  agentId: string
  nodeId: string
  timestamp: number
}

export type Theme = 'dark' | 'light' | 'system'
export type FocusLayer = 'canvas' | 'node' | 'panel'

// --- Store ---

interface UIState {
  spotlightOpen: boolean
  fileExplorerOpen: boolean
  agentPanelOpen: boolean
  activeAgentId: string | null
  theme: Theme
  focusMode: boolean
  unreadCount: number
  notifications: Notification[]
  focusLayer: FocusLayer
  focusedNodeId: string | null
  nodeActivated: boolean
  renamingNodeId: string | null
  lightboxNodeId: string | null
  settingsOpen: boolean
  nodeTouches: Record<string, number>
  agentBeams: AgentBeamTarget[]
  saveDialogOpen: boolean
  historyPanelOpen: boolean
  collapsedGroupIds: Set<string>
  isDraggingFile: boolean
}

interface UIActions {
  setSpotlightOpen: (open: boolean) => void
  setFileExplorerOpen: (open: boolean) => void
  setAgentPanelOpen: (open: boolean) => void
  setActiveAgentId: (id: string | null) => void
  setTheme: (theme: Theme) => void
  toggleFocusMode: () => void
  addNotification: (notification: Notification) => void
  updateNotification: (id: string, updates: Partial<Notification>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
  incrementUnread: () => void
  decrementUnread: () => void
  setFocusLayer: (layer: FocusLayer) => void
  setFocusedNodeId: (id: string | null) => void
  setNodeActivated: (active: boolean) => void
  setRenamingNodeId: (id: string | null) => void
  setLightboxNodeId: (id: string | null) => void
  setSettingsOpen: (open: boolean) => void
  addNodeTouch: (nodeId: string) => void
  removeNodeTouch: (nodeId: string) => void
  addAgentBeam: (beam: AgentBeamTarget) => void
  removeAgentBeam: (nodeId: string) => void
  setSaveDialogOpen: (open: boolean) => void
  setHistoryPanelOpen: (open: boolean) => void
  toggleGroupCollapse: (groupId: string) => void
  setIsDraggingFile: (dragging: boolean) => void
}

export type UIStore = UIState & UIActions

export const useUIStore = create<UIStore>()((set) => ({
  // State
  spotlightOpen: false,
  fileExplorerOpen: false,
  agentPanelOpen: false,
  activeAgentId: null,
  theme: 'dark',
  focusMode: false,
  unreadCount: 0,
  notifications: [],
  focusLayer: 'canvas',
  focusedNodeId: null,
  nodeActivated: false,
  renamingNodeId: null,
  lightboxNodeId: null,
  settingsOpen: false,
  nodeTouches: {},
  agentBeams: [],
  saveDialogOpen: false,
  historyPanelOpen: false,
  collapsedGroupIds: new Set<string>(),
  isDraggingFile: false,

  // Actions
  setSpotlightOpen: (open) => set({ spotlightOpen: open }),
  setFileExplorerOpen: (open) => set({ fileExplorerOpen: open }),
  setAgentPanelOpen: (open) => set({ agentPanelOpen: open }),
  setActiveAgentId: (id) => set({ activeAgentId: id }),
  setTheme: (theme) => set({ theme }),
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [...state.notifications, notification],
      unreadCount: state.unreadCount + 1,
    })),

  updateNotification: (id, updates) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),

  decrementUnread: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),

  setFocusLayer: (layer) => set({ focusLayer: layer }),
  setFocusedNodeId: (id) => set({ focusedNodeId: id, nodeActivated: false }),
  setNodeActivated: (active) => set({ nodeActivated: active }),
  setRenamingNodeId: (id) => set({ renamingNodeId: id }),
  setLightboxNodeId: (id) => set({ lightboxNodeId: id }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  addNodeTouch: (nodeId) =>
    set((state) => ({
      nodeTouches: { ...state.nodeTouches, [nodeId]: Date.now() },
    })),
  removeNodeTouch: (nodeId) =>
    set((state) => {
      const next = { ...state.nodeTouches }
      delete next[nodeId]
      return { nodeTouches: next }
    }),

  addAgentBeam: (beam) =>
    set((state) => ({
      agentBeams: [...state.agentBeams, beam],
    })),
  removeAgentBeam: (nodeId) =>
    set((state) => ({
      agentBeams: state.agentBeams.filter((b) => b.nodeId !== nodeId),
    })),

  setSaveDialogOpen: (open) => set({ saveDialogOpen: open }),
  setHistoryPanelOpen: (open) => set({ historyPanelOpen: open }),

  toggleGroupCollapse: (groupId) =>
    set((state) => {
      const next = new Set(state.collapsedGroupIds)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return { collapsedGroupIds: next }
    }),

  setIsDraggingFile: (dragging) => set({ isDraggingFile: dragging }),
}))

// --- Selectors ---

export const selectSpotlightOpen = (state: UIStore) => state.spotlightOpen
export const selectFileExplorerOpen = (state: UIStore) => state.fileExplorerOpen
export const selectAgentPanelOpen = (state: UIStore) => state.agentPanelOpen
export const selectActiveAgentId = (state: UIStore) => state.activeAgentId
export const selectTheme = (state: UIStore) => state.theme
export const selectFocusMode = (state: UIStore) => state.focusMode
export const selectUnreadCount = (state: UIStore) => state.unreadCount
export const selectNotifications = (state: UIStore) => state.notifications
export const selectFocusLayer = (state: UIStore) => state.focusLayer
export const selectFocusedNodeId = (state: UIStore) => state.focusedNodeId
export const selectNodeActivated = (state: UIStore) => state.nodeActivated
export const selectLightboxNodeId = (state: UIStore) => state.lightboxNodeId
export const selectSettingsOpen = (state: UIStore) => state.settingsOpen
