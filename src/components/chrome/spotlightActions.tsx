import { TerminalSquare, Globe, FileUp, StickyNote } from 'lucide-react'
import { useUIStore, useCanvasStore, useAgentStore } from '../../stores'
import type { CanvasNode, Agent } from '../../stores'
import { createNode } from './AddElementsDropdown'

// --- Types ---

export interface Suggestion {
  id: string
  icon: React.ReactNode
  label: string
  secondary?: string
  shortcut?: string
  section: string
  action: () => void
  /** When set, Tab/Enter fills input with this value instead of executing+closing */
  autocomplete?: string
}

export interface WorkspaceFile {
  name: string
  path: string
  isDirectory: boolean
}

/** A parsed step in a workflow chain */
interface ChainStep {
  type: 'agent' | 'command'
  agentName?: string
  prompt?: string
  command?: string // e.g. "a: file"
}

// --- Prefix definitions ---

export const SEARCH_PREFIXES: Record<string, { name: string; urlTemplate: string }> = {
  goog: { name: 'Google', urlTemplate: 'https://google.com/search?q=' },
  yt: { name: 'YouTube', urlTemplate: 'https://youtube.com/results?search_query=' },
  gh: { name: 'GitHub', urlTemplate: 'https://github.com/search?q=' },
  so: { name: 'Stack Overflow', urlTemplate: 'https://stackoverflow.com/search?q=' },
  rdt: { name: 'Reddit', urlTemplate: 'https://reddit.com/search/?q=' },
  twt: { name: 'Twitter/X', urlTemplate: 'https://twitter.com/search?q=' },
}

export const NODE_TYPE_MAP: Record<
  string,
  { type: 'terminal' | 'browser' | 'file' | 'note'; label: string; icon: React.ReactNode }
> = {
  terminal: { type: 'terminal', label: 'Terminal', icon: <TerminalSquare size={16} strokeWidth={1.75} /> },
  browser: { type: 'browser', label: 'Browser', icon: <Globe size={16} strokeWidth={1.75} /> },
  file: { type: 'file', label: 'File', icon: <FileUp size={16} strokeWidth={1.75} /> },
  note: { type: 'note', label: 'Note', icon: <StickyNote size={16} strokeWidth={1.75} /> },
}

// --- Helpers ---

export function panToNode(node: CanvasNode) {
  const store = useCanvasStore.getState()
  const zoom = store.zoom
  const centerX = node.position.x + node.size.w / 2
  const centerY = node.position.y + node.size.h / 2
  const panX = window.innerWidth / 2 - centerX * zoom
  const panY = window.innerHeight / 2 - centerY * zoom
  store.setPanOffset({ x: panX, y: panY })
  store.focusNode(node.id)
  useUIStore.getState().setFocusedNodeId(node.id)
}

export function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase()
  if (lower.includes(query)) return true
  const tokens = query.split(/\s+/)
  return tokens.every((t) => lower.includes(t))
}

/** Parse a workflow chain string into steps */
export function parseChain(input: string): ChainStep[] {
  const segments = input.split('>>').map((s) => s.trim())
  return segments.map((seg) => {
    const agentMatch = seg.match(/^@(\S+)\s*(.*)$/)
    if (agentMatch) {
      return { type: 'agent' as const, agentName: agentMatch[1], prompt: agentMatch[2] }
    }
    return { type: 'command' as const, command: seg }
  })
}

/** Check if input contains a workflow chain (has >>) */
export function isChain(input: string): boolean {
  return input.includes('>>')
}

/** Find agent by name (case-insensitive) */
function findAgentByName(name: string): Agent | undefined {
  return useAgentStore.getState().agents.find((a) => a.name.toLowerCase() === name.toLowerCase())
}

/** Execute a single agent invocation via IPC */
export async function invokeAgent(agentName: string, prompt: string): Promise<void> {
  const agent = findAgentByName(agentName)
  if (!agent) return

  useAgentStore.getState().setAgentStatus(agent.id, 'running')
  useAgentStore.getState().updateAgent(agent.id, { currentTask: prompt })
  useAgentStore.getState().trackRecentAgent(agent.id)

  try {
    if (window.electronAPI) {
      await window.electronAPI.invoke('agent:run', agent.name, prompt, {})
    }
  } catch {
    // Orbiter not connected yet (US-023)
  } finally {
    useAgentStore.getState().setAgentStatus(agent.id, 'idle')
    useAgentStore.getState().updateAgent(agent.id, { currentTask: '' })
  }
}

/** Execute a workflow chain sequentially, updating notification for each step */
export async function executeChain(chain: ChainStep[], notificationId: string): Promise<void> {
  const ui = useUIStore.getState()

  for (let i = 0; i < chain.length; i++) {
    const step = chain[i]

    // Update notification with step progress
    const stepLabels = chain.map((s, idx) => {
      const label = s.type === 'agent' ? `@${s.agentName}` : s.command || '...'
      if (idx < i) return `✓ ${label}`
      if (idx === i) return `▶ ${label}`
      return `○ ${label}`
    })
    ui.removeNotification(notificationId)
    ui.addNotification({
      id: notificationId,
      type: 'agent',
      title: 'Workflow Chain',
      message: stepLabels.join(' · '),
      status: 'running',
      timestamp: Date.now(),
    })

    if (step.type === 'agent' && step.agentName) {
      await invokeAgent(step.agentName, step.prompt || '')
    } else if (step.type === 'command' && step.command) {
      // Execute a: type commands
      const cmdMatch = step.command.match(/^a:\s*(\w+)$/i)
      if (cmdMatch) {
        const nodeType = cmdMatch[1].toLowerCase()
        if (nodeType in NODE_TYPE_MAP) {
          createNode(NODE_TYPE_MAP[nodeType].type)
        }
      }
    }
  }

  // Mark chain complete
  ui.removeNotification(notificationId)
  ui.addNotification({
    id: notificationId,
    type: 'agent',
    title: 'Workflow Complete',
    message: `${chain.length} steps completed`,
    status: 'done',
    timestamp: Date.now(),
  })
}

// --- Component ---
