import { create } from 'zustand'

// --- Types ---

export type AgentStatus = 'running' | 'idle' | 'waiting'

export interface Agent {
  id: string
  name: string
  color: string
  status: AgentStatus
  currentTask: string
}

export type ToolCallStatus = 'running' | 'success' | 'error'

export interface ToolCall {
  id: string
  toolName: string
  args: Record<string, unknown>
  status: ToolCallStatus
  output?: string
  error?: string
  summary?: string
  startedAt: number
  completedAt?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'tool_call'
  content: string
  timestamp: number
  toolCall?: ToolCall
}

export interface Conversation {
  messages: ChatMessage[]
}

// --- Store ---

interface AgentState {
  agents: Agent[]
  conversations: Record<string, Conversation>
  recentAgentIds: string[]
}

interface AgentActions {
  addAgent: (agent: Agent) => void
  removeAgent: (id: string) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  setAgentStatus: (id: string, status: AgentStatus) => void
  addMessage: (key: string, message: ChatMessage) => void
  updateToolCall: (key: string, toolCallId: string, updates: Partial<ToolCall>) => void
  clearConversation: (key: string) => void
  trackRecentAgent: (id: string) => void
}

export type AgentStore = AgentState & AgentActions

/** Conversation key format: `${agentId}:${canvasId}` */
export function conversationKey(agentId: string, canvasId: string): string {
  return `${agentId}:${canvasId}`
}

export const useAgentStore = create<AgentStore>()((set) => ({
  // State
  agents: [],
  conversations: {},
  recentAgentIds: [],

  // Actions
  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),

  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== id),
    })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  setAgentStatus: (id, status) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === id ? { ...a, status } : a)),
    })),

  addMessage: (key, message) =>
    set((state) => {
      const existing = state.conversations[key] ?? { messages: [] }
      return {
        conversations: {
          ...state.conversations,
          [key]: { messages: [...existing.messages, message] },
        },
      }
    }),

  updateToolCall: (key, toolCallId, updates) =>
    set((state) => {
      const conv = state.conversations[key]
      if (!conv) return state
      return {
        conversations: {
          ...state.conversations,
          [key]: {
            messages: conv.messages.map((msg) =>
              msg.toolCall?.id === toolCallId ? { ...msg, toolCall: { ...msg.toolCall, ...updates } } : msg,
            ),
          },
        },
      }
    }),

  clearConversation: (key) =>
    set((state) => {
      const next = { ...state.conversations }
      delete next[key]
      return { conversations: next }
    }),

  trackRecentAgent: (id) =>
    set((state) => ({
      recentAgentIds: [id, ...state.recentAgentIds.filter((a) => a !== id)].slice(0, 10),
    })),
}))

// --- Selectors ---

export const selectAgents = (state: AgentStore) => state.agents
export const selectConversations = (state: AgentStore) => state.conversations
export const selectAgentById = (id: string) => (state: AgentStore) => state.agents.find((a) => a.id === id)
export const selectConversation = (key: string) => (state: AgentStore) => state.conversations[key]
