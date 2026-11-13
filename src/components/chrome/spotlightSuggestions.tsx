import {
  TerminalSquare,
  Globe,
  FileUp,
  AppWindow,
  Bot,
  Command,
  Zap,
  Layers,
  Cpu,
  StickyNote,
  Navigation,
  FolderOpen,
  File,
  ExternalLink,
  Play,
  Bookmark,
  Clock,
  RotateCcw,
} from 'lucide-react'
import { useUIStore, useCanvasStore, useSettingsStore, useHistoryStore } from '../../stores'
import type { CanvasNode, CanvasMetadata, Agent } from '../../stores'
import { createNode } from './AddElementsDropdown'
import { switchCanvas } from '../../lib/canvasSave'
import { applyHistoryAction } from '../../lib/historyActions'
import {
  NODE_TYPE_MAP,
  SEARCH_PREFIXES,
  type Suggestion,
  type WorkspaceFile,
  executeChain,
  fuzzyMatch,
  invokeAgent,
  isChain,
  panToNode,
  parseChain,
} from './spotlightActions'

export function sectionIcon(name: string): React.ReactNode {
  switch (name) {
    case 'Quick Actions':
      return <Zap size={11} strokeWidth={1.75} />
    case 'Canvas Nodes':
    case 'Navigate to Node':
    case 'Filter Nodes':
      return <Layers size={11} strokeWidth={1.75} />
    case 'Agents':
    case 'Agent':
      return <Cpu size={11} strokeWidth={1.75} />
    case 'Create Node':
      return <Zap size={11} strokeWidth={1.75} />
    case 'Web Search':
      return <ExternalLink size={11} strokeWidth={1.75} />
    case 'Files':
      return <FolderOpen size={11} strokeWidth={1.75} />
    case 'Canvases':
      return <Layers size={11} strokeWidth={1.75} />
    case 'Workflows':
      return <Play size={11} strokeWidth={1.75} />
    case 'Run Agent':
    case 'Run Chain':
      return <Zap size={11} strokeWidth={1.75} />
    case 'History':
    case 'Recent History':
      return <Clock size={11} strokeWidth={1.75} />
    default:
      return null
  }
}

// --- Prefix label for badge ---

export function getPrefixLabel(query: string): string {
  const q = query.trimStart()
  if (q.startsWith('@')) return 'Agent'
  if (q.startsWith('run:')) return 'Workflow'
  if (q.startsWith('w:')) return 'Navigate'
  if (q.startsWith('fw:')) return 'Filter'
  if (q.startsWith('fc:')) return 'Canvas'
  if (q.startsWith('a:')) return 'Create'
  if (q.startsWith('history:')) return 'History'
  for (const [prefix, info] of Object.entries(SEARCH_PREFIXES)) {
    if (q.startsWith(`${prefix}:`)) return info.name
  }
  return 'Command'
}

// --- Build suggestions ---

export function buildSuggestions(
  query: string,
  nodes: CanvasNode[],
  agents: Agent[],
  recentAgentIds: string[],
  workspaceFiles: WorkspaceFile[],
  workflows: { name: string; chain: string }[],
  canvases: CanvasMetadata[],
  activeCanvasId: string,
  _onClose: () => void,
): Suggestion[] {
  const q = query.trim()
  const qLower = q.toLowerCase()

  // --- @ prefix: agent interaction ---
  if (q.startsWith('@')) {
    return buildAgentSuggestions(q, agents, recentAgentIds)
  }

  // --- run: prefix: saved workflows ---
  if (qLower.startsWith('run:')) {
    return buildWorkflowSuggestions(q.slice(4).trim(), workflows)
  }

  // --- history: prefix: open history panel ---
  if (qLower.startsWith('history:') || qLower === 'history') {
    return buildHistorySuggestions()
  }

  // --- Prefix detection ---
  const prefixMatch = q.match(/^(w|fw|fc|a|goog|yt|gh|so|rdt|twt):\s*(.*)$/i)
  if (prefixMatch) {
    const prefix = prefixMatch[1].toLowerCase()
    const arg = prefixMatch[2].trim()

    if (prefix === 'w') return buildNavigateSuggestions(arg, nodes)
    if (prefix === 'fw') return buildFilterSuggestions(arg, nodes)
    if (prefix === 'fc') return buildCanvasSuggestions(arg, canvases, activeCanvasId)
    if (prefix === 'a') return buildAddSuggestions(arg)
    if (prefix in SEARCH_PREFIXES) return buildWebSearchSuggestions(prefix, arg)
  }

  // --- Number-only query: prioritize node with that window ID ---
  if (/^\d+$/.test(q)) {
    const results: Suggestion[] = []
    const matchNode = nodes.find((n) => n.id === q)
    if (matchNode) {
      results.push({
        id: `node-jump:${matchNode.id}`,
        icon: nodeIcon(matchNode.type),
        label: matchNode.title || matchNode.type,
        secondary: `[${matchNode.id}] — Jump to node`,
        section: 'Canvas Nodes',
        action: () => panToNode(matchNode),
      })
    }
    nodes
      .filter((n) => n.id !== q && n.id.startsWith(q))
      .forEach((n) => {
        results.push({
          id: `node:${n.id}`,
          icon: nodeIcon(n.type),
          label: n.title || n.type,
          secondary: `[${n.id}] ${n.type}`,
          section: 'Canvas Nodes',
          action: () => panToNode(n),
        })
      })
    return results
  }

  // --- Default fuzzy search ---
  return buildDefaultSuggestions(qLower, nodes, agents, recentAgentIds, workspaceFiles, workflows)
}

// --- @ Agent suggestions ---

function buildAgentSuggestions(raw: string, agents: Agent[], recentAgentIds: string[]): Suggestion[] {
  // Strip leading @
  const afterAt = raw.slice(1)

  // Check if there's a space (meaning agent name is complete)
  const spaceIndex = afterAt.indexOf(' ')

  if (spaceIndex === -1) {
    // No space — still typing agent name, show autocomplete suggestions
    const partial = afterAt.toLowerCase()

    // Sort agents: running first, then recently invoked, then alphabetical
    const sorted = [...agents].sort((a, b) => {
      // Running agents first
      if (a.status === 'running' && b.status !== 'running') return -1
      if (b.status === 'running' && a.status !== 'running') return 1
      // Then by recency
      const aRecent = recentAgentIds.indexOf(a.id)
      const bRecent = recentAgentIds.indexOf(b.id)
      const aScore = aRecent === -1 ? Infinity : aRecent
      const bScore = bRecent === -1 ? Infinity : bRecent
      if (aScore !== bScore) return aScore - bScore
      // Then alphabetical
      return a.name.localeCompare(b.name)
    })

    const filtered = partial.length === 0 ? sorted : sorted.filter((a) => fuzzyMatch(a.name, partial))

    return filtered.map((agent) => ({
      id: `@autocomplete:${agent.id}`,
      icon: (
        <span
          style={{
            display: 'inline-block',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: agent.color || 'var(--accent-blue)',
          }}
        />
      ),
      label: agent.name,
      secondary: agent.status === 'running' ? agent.currentTask || 'running' : agent.status,
      section: 'Agents',
      action: () => {},
      autocomplete: `@${agent.name} `,
      shortcut: 'Tab',
    }))
  }

  // Space found — agent name is complete, prompt follows
  const agentName = afterAt.slice(0, spaceIndex)
  const prompt = afterAt.slice(spaceIndex + 1).trim()

  // Check if this is a chain (contains >>)
  if (isChain(raw)) {
    return buildChainSuggestions(raw)
  }

  // Find the agent
  const agent = agents.find((a) => a.name.toLowerCase() === agentName.toLowerCase())

  if (!agent) {
    return [
      {
        id: '@agent:not-found',
        icon: <Bot size={16} strokeWidth={1.75} />,
        label: `Agent "${agentName}" not found`,
        secondary: 'Check agent name',
        section: 'Agent',
        action: () => {},
      },
    ]
  }

  const results: Suggestion[] = []

  if (prompt.length === 0) {
    // No prompt yet — show hint
    results.push({
      id: `@run-hint:${agent.id}`,
      icon: <Bot size={16} strokeWidth={1.75} />,
      label: `Ask @${agent.name}…`,
      secondary: 'Type a prompt and press Enter',
      section: 'Agent',
      action: () => {},
    })
  } else {
    // Prompt is present — show run suggestion
    results.push({
      id: `@run:${agent.id}`,
      icon: <Zap size={16} strokeWidth={1.75} />,
      label: `Run @${agent.name}: "${prompt.length > 40 ? prompt.slice(0, 40) + '…' : prompt}"`,
      section: 'Run Agent',
      action: () => {
        // Create notification
        const notifId = `agent-run-${agent.id}-${Date.now()}`
        useUIStore.getState().addNotification({
          id: notifId,
          type: 'agent',
          title: `@${agent.name}`,
          message: prompt,
          status: 'running',
          agentId: agent.id,
          timestamp: Date.now(),
          startedAt: Date.now(),
          toolCalls: [],
        })
        // Invoke agent
        invokeAgent(agent.name, prompt).then(() => {
          const ui = useUIStore.getState()
          ui.removeNotification(notifId)
          ui.addNotification({
            id: notifId,
            type: 'agent',
            title: `@${agent.name}`,
            message: 'Completed',
            status: 'done',
            agentId: agent.id,
            timestamp: Date.now(),
          })
        })
      },
    })

    // Also show option to open agent panel instead
    results.push({
      id: `@open-panel:${agent.id}`,
      icon: <Bot size={16} strokeWidth={1.75} />,
      label: `Open @${agent.name} panel`,
      secondary: 'Chat interactively',
      section: 'Agent',
      action: () => {
        useUIStore.getState().setActiveAgentId(agent.id)
        useUIStore.getState().setAgentPanelOpen(true)
      },
    })
  }

  return results
}

// --- Chain suggestions (>> syntax) ---

function buildChainSuggestions(raw: string): Suggestion[] {
  const chain = parseChain(raw)
  const stepLabels = chain.map((step) => {
    if (step.type === 'agent') return `@${step.agentName}`
    return step.command || '...'
  })

  return [
    {
      id: `chain:${raw}`,
      icon: <Zap size={16} strokeWidth={1.75} />,
      label: `Run chain: ${stepLabels.join(' → ')}`,
      secondary: `${chain.length} steps`,
      section: 'Run Chain',
      action: () => {
        const notifId = `chain-${Date.now()}`
        const rawChain = raw

        // Create initial notification
        useUIStore.getState().addNotification({
          id: notifId,
          type: 'agent',
          title: 'Workflow Chain',
          message: `Starting ${chain.length} steps…`,
          status: 'running',
          timestamp: Date.now(),
        })

        // Execute chain
        executeChain(chain, notifId).then(() => {
          // After chain completes, offer save
          const ui = useUIStore.getState()
          ui.removeNotification(notifId)
          ui.addNotification({
            id: `${notifId}-done`,
            type: 'agent',
            title: 'Workflow Complete',
            message: `${chain.length} steps completed — Save as workflow?`,
            status: 'done',
            timestamp: Date.now(),
          })

          // Prompt to save workflow (using window.prompt as a simple UX)
          const name = window.prompt('Save this workflow? Enter a name (or cancel to skip):')
          if (name && name.trim()) {
            useSettingsStore.getState().addWorkflow({
              name: name.trim(),
              chain: rawChain,
            })
            ui.removeNotification(`${notifId}-done`)
            ui.addNotification({
              id: `${notifId}-saved`,
              type: 'system',
              title: 'Workflow Saved',
              message: `"${name.trim()}" saved — use "run: ${name.trim()}" in Spotlight`,
              status: 'done',
              timestamp: Date.now(),
              autoDismiss: true,
            })
          }
        })
      },
    },
  ]
}

// --- run: Saved workflows ---

function buildWorkflowSuggestions(arg: string, workflows: { name: string; chain: string }[]): Suggestion[] {
  const argLower = arg.toLowerCase()

  const filtered = arg.length === 0 ? workflows : workflows.filter((w) => fuzzyMatch(w.name, argLower))

  if (filtered.length === 0) {
    return [
      {
        id: 'run:empty',
        icon: <Bookmark size={16} strokeWidth={1.75} />,
        label: workflows.length === 0 ? 'No saved workflows' : `No workflows matching "${arg}"`,
        secondary: 'Use @agent >> @agent to create chains',
        section: 'Workflows',
        action: () => {},
      },
    ]
  }

  return filtered.map((w) => ({
    id: `run:${w.name}`,
    icon: <Play size={16} strokeWidth={1.75} />,
    label: w.name,
    secondary: w.chain,
    section: 'Workflows',
    action: () => {
      const chain = parseChain(w.chain)
      const notifId = `workflow-${Date.now()}`

      useUIStore.getState().addNotification({
        id: notifId,
        type: 'agent',
        title: `Workflow: ${w.name}`,
        message: `Starting ${chain.length} steps…`,
        status: 'running',
        timestamp: Date.now(),
      })

      executeChain(chain, notifId)
    },
  }))
}

// --- w: Navigate to node ---

function buildNavigateSuggestions(arg: string, nodes: CanvasNode[]): Suggestion[] {
  const argLower = arg.toLowerCase()

  const matching =
    arg.length === 0
      ? nodes
      : nodes.filter((n) => n.id === arg || fuzzyMatch(n.title || '', argLower) || fuzzyMatch(n.type, argLower))

  return matching.map((node) => ({
    id: `nav:${node.id}`,
    icon: <Navigation size={16} strokeWidth={1.75} />,
    label: node.title || node.type,
    secondary: `[${node.id}] ${node.type}`,
    section: 'Navigate to Node',
    action: () => panToNode(node),
  }))
}

// --- fw: Filter canvas nodes ---

function buildFilterSuggestions(arg: string, nodes: CanvasNode[]): Suggestion[] {
  const argLower = arg.toLowerCase()

  const matching =
    arg.length === 0
      ? nodes
      : nodes.filter((n) => fuzzyMatch(n.title || '', argLower) || fuzzyMatch(n.type, argLower) || n.id === arg)

  return matching.map((node) => ({
    id: `filter:${node.id}`,
    icon: nodeIcon(node.type),
    label: node.title || node.type,
    secondary: `[${node.id}] ${node.type}`,
    section: 'Filter Nodes',
    action: () => {
      useCanvasStore.getState().focusNode(node.id)
      useUIStore.getState().setFocusedNodeId(node.id)
    },
  }))
}

// --- fc: Switch canvas ---

function buildCanvasSuggestions(arg: string, canvases: CanvasMetadata[], activeCanvasId: string): Suggestion[] {
  const argLower = arg.toLowerCase()

  const filtered = arg.length === 0 ? canvases : canvases.filter((c) => fuzzyMatch(c.name, argLower))

  const results: Suggestion[] = filtered.map((canvas) => {
    const isCurrent = canvas.id === activeCanvasId
    return {
      id: `fc:${canvas.id}`,
      icon: <Layers size={16} strokeWidth={1.75} />,
      label: canvas.name,
      secondary: isCurrent ? 'Current' : `${canvas.nodeCount} nodes`,
      section: 'Canvases',
      action: () => {
        if (!isCurrent) {
          switchCanvas(canvas.id).then(() => {
            document.title = `Flow — ${canvas.name}`
          })
        }
      },
    }
  })

  // Always show "New Canvas" option
  results.push({
    id: 'fc:new',
    icon: <Zap size={16} strokeWidth={1.75} />,
    label: 'New Canvas',
    secondary: 'Create a new canvas',
    section: 'Canvases',
    action: () => {
      const store = useCanvasStore.getState()
      const name = `Canvas — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      const id = `canvas-${Date.now()}`
      const canvas: CanvasMetadata = {
        id,
        name,
        createdAt: Date.now(),
        lastSavedAt: Date.now(),
        nodeCount: 0,
      }
      store.addCanvas(canvas)
      switchCanvas(id).then(() => {
        document.title = `Flow — ${name}`
      })
    },
  })

  return results
}

// --- a: Add node ---

function buildAddSuggestions(arg: string): Suggestion[] {
  const argLower = arg.toLowerCase()

  const options = Object.entries(NODE_TYPE_MAP)
    .filter(([key, info]) => arg.length === 0 || key.startsWith(argLower) || fuzzyMatch(info.label, argLower))
    .map(([key, info]) => ({
      id: `add:${key}`,
      icon: info.icon,
      label: `Add ${info.label}`,
      section: 'Create Node',
      action: () => {
        if (info.type === 'file') {
          if (window.electronAPI) {
            window.electronAPI.invoke('dialog:openFile').then((filePath) => {
              if (filePath) createNode('file', { filePath: filePath as string })
            })
          } else {
            createNode('file')
          }
        } else {
          createNode(info.type)
        }
      },
    }))

  return options
}

// --- Web search prefixes ---

function buildWebSearchSuggestions(prefix: string, arg: string): Suggestion[] {
  const info = SEARCH_PREFIXES[prefix]
  if (!info) return []

  if (arg.length === 0) {
    return [
      {
        id: `search:${prefix}:hint`,
        icon: <Globe size={16} strokeWidth={1.75} />,
        label: `Search ${info.name}…`,
        secondary: 'Type a query',
        section: 'Web Search',
        action: () => {},
      },
    ]
  }

  return [
    {
      id: `search:${prefix}:${arg}`,
      icon: <ExternalLink size={16} strokeWidth={1.75} />,
      label: `Search "${arg}" on ${info.name}`,
      section: 'Web Search',
      action: () => {
        const url = info.urlTemplate + encodeURIComponent(arg)
        createNode('browser', { initialUrl: url, title: `${info.name}: ${arg}` })
      },
    },
  ]
}

// --- Default suggestions (no prefix) ---

function buildDefaultSuggestions(
  qLower: string,
  nodes: CanvasNode[],
  agents: Agent[],
  recentAgentIds: string[],
  workspaceFiles: WorkspaceFile[],
  workflows: { name: string; chain: string }[],
): Suggestion[] {
  const results: Suggestion[] = []

  // Quick actions
  const quickActions: Suggestion[] = [
    {
      id: 'action:terminal',
      icon: <TerminalSquare size={16} strokeWidth={1.75} />,
      label: 'Add Terminal',
      shortcut: '⌘T',
      section: 'Quick Actions',
      action: () => createNode('terminal'),
    },
    {
      id: 'action:browser',
      icon: <Globe size={16} strokeWidth={1.75} />,
      label: 'Add Browser',
      shortcut: '⌘B',
      section: 'Quick Actions',
      action: () => createNode('browser'),
    },
    {
      id: 'action:file',
      icon: <FileUp size={16} strokeWidth={1.75} />,
      label: 'Add File',
      shortcut: '⌘O',
      section: 'Quick Actions',
      action: () => {
        if (window.electronAPI) {
          window.electronAPI.invoke('dialog:openFile').then((filePath) => {
            if (filePath) createNode('file', { filePath: filePath as string })
          })
        } else {
          createNode('file')
        }
      },
    },
    {
      id: 'action:webapp',
      icon: <AppWindow size={16} strokeWidth={1.75} />,
      label: 'Add Web App',
      shortcut: '⌘W',
      section: 'Quick Actions',
      action: () => createNode('webapp'),
    },
  ]

  // Canvas nodes
  const nodeItems: Suggestion[] = nodes.map((node) => ({
    id: `node:${node.id}`,
    icon: nodeIcon(node.type),
    label: node.title || node.type,
    secondary: `[${node.id}] ${node.type}`,
    section: 'Canvas Nodes',
    action: () => panToNode(node),
  }))

  // Agents — sorted by running first, then recent, then alphabetical
  const sortedAgents = [...agents].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1
    if (b.status === 'running' && a.status !== 'running') return 1
    const aRecent = recentAgentIds.indexOf(a.id)
    const bRecent = recentAgentIds.indexOf(b.id)
    const aScore = aRecent === -1 ? Infinity : aRecent
    const bScore = bRecent === -1 ? Infinity : bRecent
    if (aScore !== bScore) return aScore - bScore
    return a.name.localeCompare(b.name)
  })

  const agentItems: Suggestion[] = sortedAgents.map((agent) => ({
    id: `agent:${agent.id}`,
    icon: <Bot size={16} strokeWidth={1.75} />,
    label: agent.name,
    secondary: agent.status === 'running' ? agent.currentTask || 'running' : agent.status,
    section: 'Agents',
    action: () => {
      useUIStore.getState().setActiveAgentId(agent.id)
      useUIStore.getState().setAgentPanelOpen(true)
    },
  }))

  // Workspace files
  const fileItems: Suggestion[] = workspaceFiles.map((f) => ({
    id: `file:${f.path}`,
    icon: <File size={16} strokeWidth={1.75} />,
    label: f.name,
    secondary: f.path,
    section: 'Files',
    action: () => {
      createNode('file', { filePath: f.path, title: f.name })
    },
  }))

  // Workflow items
  const workflowItems: Suggestion[] = workflows.map((w) => ({
    id: `workflow:${w.name}`,
    icon: <Play size={16} strokeWidth={1.75} />,
    label: `run: ${w.name}`,
    secondary: w.chain,
    section: 'Workflows',
    action: () => {
      const chain = parseChain(w.chain)
      const notifId = `workflow-${Date.now()}`
      useUIStore.getState().addNotification({
        id: notifId,
        type: 'agent',
        title: `Workflow: ${w.name}`,
        message: `Starting ${chain.length} steps…`,
        status: 'running',
        timestamp: Date.now(),
      })
      executeChain(chain, notifId)
    },
  }))

  if (qLower.length === 0) {
    results.push(...quickActions)
    if (nodeItems.length > 0) results.push(...nodeItems.slice(0, 5))
    if (agentItems.length > 0) results.push(...agentItems)
    if (workflowItems.length > 0) results.push(...workflowItems)
  } else {
    const filteredActions = quickActions.filter((a) => fuzzyMatch(a.label, qLower))
    const filteredNodes = nodeItems.filter((n) => fuzzyMatch(n.label, qLower) || fuzzyMatch(n.secondary || '', qLower))
    const filteredAgents = agentItems.filter((a) => fuzzyMatch(a.label, qLower))
    const filteredFiles = fileItems.filter((f) => fuzzyMatch(f.label, qLower))
    const filteredWorkflows = workflowItems.filter((w) => fuzzyMatch(w.label, qLower))

    if (filteredNodes.length > 0) results.push(...filteredNodes)
    if (filteredActions.length > 0) results.push(...filteredActions)
    if (filteredAgents.length > 0) results.push(...filteredAgents)
    if (filteredWorkflows.length > 0) results.push(...filteredWorkflows)
    if (filteredFiles.length > 0) results.push(...filteredFiles.slice(0, 10))
  }

  return results
}

// --- history: History panel ---

function buildHistorySuggestions(): Suggestion[] {
  const undoStack = useHistoryStore.getState().undoStack
  const results: Suggestion[] = []

  // Open history panel action
  results.push({
    id: 'history:open',
    icon: <Clock size={16} strokeWidth={1.75} />,
    label: 'Open History Panel',
    secondary: `${undoStack.length} actions`,
    section: 'History',
    action: () => {
      useUIStore.getState().setHistoryPanelOpen(true)
    },
  })

  // Show recent entries (last 5)
  const recent = [...undoStack].reverse().slice(0, 5)
  for (const entry of recent) {
    results.push({
      id: `history:entry:${entry.id}`,
      icon: <RotateCcw size={16} strokeWidth={1.75} />,
      label: entry.description,
      secondary: formatTimeAgo(entry.timestamp),
      section: 'Recent History',
      action: () => {
        // Revert to this entry: undo everything after it
        const store = useHistoryStore.getState()
        const idx = store.undoStack.findIndex((e) => e.id === entry.id)
        if (idx === -1) return
        const count = store.undoStack.length - 1 - idx
        for (let i = 0; i < count; i++) {
          const e = useHistoryStore.getState().undo()
          if (e) {
            applyHistoryAction(e.undo)
          }
        }
      },
    })
  }

  return results
}

function formatTimeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
}

function nodeIcon(type: string): React.ReactNode {
  switch (type) {
    case 'terminal':
      return <TerminalSquare size={16} strokeWidth={1.75} />
    case 'browser':
      return <Globe size={16} strokeWidth={1.75} />
    case 'file':
      return <FileUp size={16} strokeWidth={1.75} />
    case 'webapp':
      return <AppWindow size={16} strokeWidth={1.75} />
    case 'note':
      return <StickyNote size={16} strokeWidth={1.75} />
    default:
      return <Command size={16} strokeWidth={1.75} />
  }
}
