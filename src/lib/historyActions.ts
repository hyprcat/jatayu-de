/**
 * History-tracked canvas actions.
 *
 * These functions wrap canvasStore actions and push corresponding entries
 * to historyStore so that ⌘Z / ⌘⇧Z can reverse them.
 */
import { useCanvasStore, type CanvasNode, type NodeGroup } from '../stores/canvasStore'
import { useHistoryStore, type HistoryEntry, type HistoryActionData } from '../stores/historyStore'

let entryCounter = 0

function makeId(): string {
  return `h-${Date.now()}-${++entryCounter}`
}

/** Push a history entry and clear the redo stack. */
function push(entry: HistoryEntry) {
  useHistoryStore.getState().pushAction(entry)
}

// ─── Tracked Actions ───

export function trackedAddNode(node: CanvasNode) {
  useCanvasStore.getState().addNode(node)
  push({
    id: makeId(),
    type: 'addNode',
    timestamp: Date.now(),
    description: `Add ${node.type} "${node.title}"`,
    undo: { type: 'addNode', nodeId: node.id, node },
    redo: { type: 'addNode', node },
  })
}

export function trackedRemoveNode(id: string) {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === id)
  if (!node) return
  // Snapshot the node before removing
  const snapshot: CanvasNode = { ...node, metadata: { ...node.metadata } }
  useCanvasStore.getState().removeNode(id)
  push({
    id: makeId(),
    type: 'removeNode',
    timestamp: Date.now(),
    description: `Remove ${snapshot.type} "${snapshot.title}"`,
    undo: { type: 'removeNode', nodeId: id, node: snapshot },
    redo: { type: 'removeNode', nodeId: id },
  })
}

export function trackedMoveNode(id: string, position: { x: number; y: number }) {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === id)
  if (!node) return
  const oldPosition = { ...node.position }
  useCanvasStore.getState().moveNode(id, position)
  push({
    id: makeId(),
    type: 'moveNode',
    timestamp: Date.now(),
    description: `Move "${node.title}"`,
    undo: { type: 'moveNode', nodeId: id, position: oldPosition },
    redo: { type: 'moveNode', nodeId: id, position },
  })
}

export function trackedResizeNode(id: string, size: { w: number; h: number }) {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === id)
  if (!node) return
  const oldSize = { ...node.size }
  useCanvasStore.getState().resizeNode(id, size)
  push({
    id: makeId(),
    type: 'resizeNode',
    timestamp: Date.now(),
    description: `Resize "${node.title}"`,
    undo: { type: 'resizeNode', nodeId: id, size: oldSize },
    redo: { type: 'resizeNode', nodeId: id, size },
  })
}

export function trackedGroupCreate(group: NodeGroup) {
  useCanvasStore.getState().addGroup(group)
  push({
    id: makeId(),
    type: 'groupCreate',
    timestamp: Date.now(),
    description: `Create group "${group.name}"`,
    undo: { type: 'groupCreate', group },
    redo: { type: 'groupCreate', group },
  })
}

export function trackedGroupRemove(groupId: string) {
  const group = useCanvasStore.getState().groups.find((g) => g.id === groupId)
  if (!group) return
  const snapshot: NodeGroup = { ...group, nodeIds: [...group.nodeIds] }
  useCanvasStore.getState().removeGroup(groupId)
  push({
    id: makeId(),
    type: 'groupRemove',
    timestamp: Date.now(),
    description: `Remove group "${snapshot.name}"`,
    undo: { type: 'groupRemove', group: snapshot },
    redo: { type: 'groupRemove', group: snapshot },
  })
}

export function trackedRenameNode(id: string, newTitle: string) {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === id)
  if (!node) return
  const oldTitle = node.title
  useCanvasStore.getState().updateNode(id, { title: newTitle })
  push({
    id: makeId(),
    type: 'renameNode',
    timestamp: Date.now(),
    description: `Rename "${oldTitle}" → "${newTitle}"`,
    undo: { type: 'renameNode', nodeId: id, title: oldTitle },
    redo: { type: 'renameNode', nodeId: id, title: newTitle },
  })
}

// ─── Apply History Action ───

/**
 * Apply a HistoryActionData — used by both undo and redo.
 * The direction (undo vs redo) determines which data field is applied.
 */
export function applyHistoryAction(data: HistoryActionData) {
  const store = useCanvasStore.getState()

  switch (data.type) {
    case 'addNode':
      if (data.node) {
        // Redo add: re-add the node
        store.addNode(data.node)
      } else if (data.nodeId) {
        // Undo add: remove the node
        store.removeNode(data.nodeId)
      }
      break

    case 'removeNode':
      if (data.node) {
        // Undo remove: re-add the node
        store.addNode(data.node)
      } else if (data.nodeId) {
        // Redo remove: remove the node again
        store.removeNode(data.nodeId)
      }
      break

    case 'moveNode':
      if (data.nodeId && data.position) {
        store.moveNode(data.nodeId, data.position)
      }
      break

    case 'resizeNode':
      if (data.nodeId && data.size) {
        store.resizeNode(data.nodeId, data.size)
      }
      break

    case 'groupCreate':
      if (data.group) {
        // Undo groupCreate: remove the group; redo: add it back
        const existing = store.groups.find((g) => g.id === data.group!.id)
        if (existing) {
          store.removeGroup(data.group.id)
        } else {
          store.addGroup(data.group)
        }
      }
      break

    case 'groupRemove':
      if (data.group) {
        // Undo groupRemove: re-add the group; redo: remove it
        const existing = store.groups.find((g) => g.id === data.group!.id)
        if (existing) {
          store.removeGroup(data.group.id)
        } else {
          store.addGroup(data.group)
        }
      }
      break

    case 'renameNode':
      if (data.nodeId && data.title !== undefined) {
        store.updateNode(data.nodeId, { title: data.title })
      }
      break
  }
}

/**
 * Execute undo: pop from undoStack, apply undo data, push to redoStack.
 * Returns true if an action was undone.
 */
export function executeUndo(): boolean {
  const entry = useHistoryStore.getState().undo()
  if (!entry) return false
  applyHistoryAction(entry.undo)
  return true
}

/**
 * Execute redo: pop from redoStack, apply redo data, push to undoStack.
 * Returns true if an action was redone.
 */
export function executeRedo(): boolean {
  const entry = useHistoryStore.getState().redo()
  if (!entry) return false
  applyHistoryAction(entry.redo)
  return true
}
