import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// --- Types ---

export interface WebApp {
  name: string
  url: string
  iconUrl?: string
  category?: string
}

export interface Workflow {
  name: string
  chain: string // raw chain string, e.g. "@agent1 prompt >> @agent2 prompt >> a: file"
}

/** Monthly token usage entry per agent */
export interface TokenUsageEntry {
  agentId: string
  agentName: string
  month: string // YYYY-MM
  tokens: number
}

/** Per-model token price (per 1K tokens) */
export interface ModelPricing {
  provider: string
  modelId: string
  pricePerKToken: number // in USD
}

// --- Store ---

interface SettingsState {
  workspaceDir: string
  autoSaveIntervalSec: number
  webApps: WebApp[]
  orbiterPath: string
  keyboardShortcuts: Record<string, string>
  onboardingComplete: boolean
  fileAssociationsEnabled: boolean
  workflows: Workflow[]
  canvasHintsEnabled: boolean
  hintIntervalSec: number
  dotGridVisible: boolean
  highContrastMode: boolean
  startupCanvasId: string
  tokenUsage: TokenUsageEntry[]
  modelPricing: ModelPricing[]
}

interface SettingsActions {
  setWorkspaceDir: (dir: string) => void
  setAutoSaveInterval: (sec: number) => void
  addWebApp: (app: WebApp) => void
  removeWebApp: (name: string) => void
  updateWebApp: (name: string, updates: Partial<WebApp>) => void
  setOrbiterPath: (path: string) => void
  setKeyboardShortcut: (action: string, binding: string) => void
  setOnboardingComplete: (complete: boolean) => void
  setFileAssociationsEnabled: (enabled: boolean) => void
  addWorkflow: (workflow: Workflow) => void
  removeWorkflow: (name: string) => void
  setCanvasHintsEnabled: (enabled: boolean) => void
  setHintIntervalSec: (sec: number) => void
  setDotGridVisible: (visible: boolean) => void
  setHighContrastMode: (enabled: boolean) => void
  setStartupCanvasId: (id: string) => void
  trackTokenUsage: (agentId: string, agentName: string, tokens: number) => void
  setModelPricing: (pricing: ModelPricing[]) => void
}

export type SettingsStore = SettingsState & SettingsActions

const DEFAULT_WEB_APPS: WebApp[] = [
  { name: 'ChatGPT', url: 'https://chat.openai.com', category: 'AI' },
  { name: 'Claude', url: 'https://claude.ai', category: 'AI' },
  { name: 'Notion', url: 'https://notion.so', category: 'Productivity' },
  { name: 'Figma', url: 'https://figma.com', category: 'Design' },
  { name: 'Linear', url: 'https://linear.app', category: 'Project' },
  { name: 'GitHub', url: 'https://github.com', category: 'Dev' },
  { name: 'Gmail', url: 'https://mail.google.com', category: 'Communication' },
  { name: 'Google Docs', url: 'https://docs.google.com', category: 'Productivity' },
  { name: 'Slack', url: 'https://app.slack.com', category: 'Communication' },
  { name: 'Discord', url: 'https://discord.com/app', category: 'Communication' },
]

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // State
      workspaceDir: '~/Flow',
      autoSaveIntervalSec: 30,
      webApps: DEFAULT_WEB_APPS,
      orbiterPath: 'python3 -m orbiter',
      keyboardShortcuts: {},
      onboardingComplete: false,
      fileAssociationsEnabled: false,
      workflows: [],
      canvasHintsEnabled: true,
      hintIntervalSec: 60,
      dotGridVisible: true,
      highContrastMode: false,
      startupCanvasId: 'canvas-1',
      tokenUsage: [],
      modelPricing: [
        { provider: 'openai', modelId: 'gpt-4', pricePerKToken: 0.03 },
        { provider: 'openai', modelId: 'gpt-3.5-turbo', pricePerKToken: 0.002 },
        { provider: 'anthropic', modelId: 'claude-3-opus', pricePerKToken: 0.015 },
        { provider: 'anthropic', modelId: 'claude-3-sonnet', pricePerKToken: 0.003 },
      ],

      // Actions
      setWorkspaceDir: (dir) => set({ workspaceDir: dir }),

      setAutoSaveInterval: (sec) => set({ autoSaveIntervalSec: Math.min(300, Math.max(10, sec)) }),

      addWebApp: (app) => set((state) => ({ webApps: [...state.webApps, app] })),

      removeWebApp: (name) =>
        set((state) => ({
          webApps: state.webApps.filter((a) => a.name !== name),
        })),

      updateWebApp: (name, updates) =>
        set((state) => ({
          webApps: state.webApps.map((a) => (a.name === name ? { ...a, ...updates } : a)),
        })),

      setOrbiterPath: (path) => set({ orbiterPath: path }),

      setKeyboardShortcut: (action, binding) =>
        set((state) => ({
          keyboardShortcuts: { ...state.keyboardShortcuts, [action]: binding },
        })),

      setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),

      setFileAssociationsEnabled: (enabled) => set({ fileAssociationsEnabled: enabled }),

      addWorkflow: (workflow) => set((state) => ({ workflows: [...state.workflows, workflow] })),

      removeWorkflow: (name) =>
        set((state) => ({
          workflows: state.workflows.filter((w) => w.name !== name),
        })),

      setCanvasHintsEnabled: (enabled) => set({ canvasHintsEnabled: enabled }),
      setHintIntervalSec: (sec) => set({ hintIntervalSec: Math.max(10, sec) }),
      setDotGridVisible: (visible) => set({ dotGridVisible: visible }),
      setHighContrastMode: (enabled) => set({ highContrastMode: enabled }),
      setStartupCanvasId: (id) => set({ startupCanvasId: id }),

      trackTokenUsage: (agentId, agentName, tokens) =>
        set((state) => {
          const month = new Date().toISOString().slice(0, 7) // YYYY-MM
          const existing = state.tokenUsage.find((e) => e.agentId === agentId && e.month === month)
          if (existing) {
            return {
              tokenUsage: state.tokenUsage.map((e) =>
                e.agentId === agentId && e.month === month ? { ...e, tokens: e.tokens + tokens, agentName } : e,
              ),
            }
          }
          return {
            tokenUsage: [...state.tokenUsage, { agentId, agentName, month, tokens }],
          }
        }),

      setModelPricing: (pricing) => set({ modelPricing: pricing }),
    }),
    {
      name: 'flow-settings-store',
    },
  ),
)

// --- Selectors ---

export const selectWorkspaceDir = (state: SettingsStore) => state.workspaceDir
export const selectAutoSaveInterval = (state: SettingsStore) => state.autoSaveIntervalSec
export const selectWebApps = (state: SettingsStore) => state.webApps
export const selectOrbiterPath = (state: SettingsStore) => state.orbiterPath
export const selectKeyboardShortcuts = (state: SettingsStore) => state.keyboardShortcuts
export const selectOnboardingComplete = (state: SettingsStore) => state.onboardingComplete
