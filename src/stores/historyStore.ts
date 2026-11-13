import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CanvasNode, NodeGroup } from './canvasStore'

// --- Types ---

export type HistoryActionType =
  'addNode' | 'removeNode' | 'moveNode' | 'resizeNode' | 'groupCreate' | 'groupRemove' | 'renameNode'

export interface HistoryEntry {
  id: string
  type: HistoryActionType
  timestamp: number
  description: string
  /** Data needed to undo this action */
  undo: HistoryActionData
  /** Data needed to redo this action */
  redo: HistoryActionData
}

export interface HistoryActionData {
  type: HistoryActionType
  nodeId?: string
  node?: CanvasNode
  position?: { x: number; y: number }
  size?: { w: number; h: number }
  group?: NodeGroup
  title?: string
}

// --- Store ---

const MAX_HISTORY = 100

interface HistoryState {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
}

interface HistoryActions {
  pushAction: (entry: HistoryEntry) => void
  undo: () => HistoryEntry | null
  redo: () => HistoryEntry | null
  clear: () => void
}

export type HistoryStore = HistoryState & HistoryActions

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      undoStack: [],
      redoStack: [],

      pushAction: (entry) =>
        set((state) => ({
          undoStack: [...state.undoStack, entry].slice(-MAX_HISTORY),
          redoStack: [], // clear redo on new action
        })),

      undo: () => {
        const { undoStack, redoStack } = get()
        if (undoStack.length === 0) return null
        const entry = undoStack[undoStack.length - 1]
        set({
          undoStack: undoStack.slice(0, -1),
          redoStack: [...redoStack, entry].slice(-MAX_HISTORY),
        })
        return entry
      },

      redo: () => {
        const { undoStack, redoStack } = get()
        if (redoStack.length === 0) return null
        const entry = redoStack[redoStack.length - 1]
        set({
          redoStack: redoStack.slice(0, -1),
          undoStack: [...undoStack, entry].slice(-MAX_HISTORY),
        })
        return entry
      },

      clear: () => set({ undoStack: [], redoStack: [] }),
    }),
    {
      name: 'flow-history-store',
    },
  ),
)

// --- Selectors ---

export const selectUndoStack = (state: HistoryStore) => state.undoStack
export const selectRedoStack = (state: HistoryStore) => state.redoStack
