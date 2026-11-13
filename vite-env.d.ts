/// <reference types="vite/client" />

interface ElectronAPI {
  send: (channel: string, ...args: unknown[]) => void
  on: (channel: string, listener: (...args: unknown[]) => void) => unknown
  off: (channel: string, wrappedListener: unknown) => void
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
}

interface OrbiterAPI {
  agent: {
    list: () => Promise<unknown>
    run: (name: string, input: string, context: unknown) => Promise<unknown>
    stream: (name: string, input: string, context: unknown) => Promise<unknown>
    status: (name: string) => Promise<unknown>
    stop: (name: string) => Promise<unknown>
  }
  status: () => Promise<{ status: string; error: string }>
  restart: (orbiterPath: string) => Promise<{ status: string; error: string }>
  spawn: (orbiterPath: string) => Promise<{ status: string; error: string }>
  onStreamChunk: (handler: (...args: unknown[]) => void) => unknown
  offStreamChunk: (wrapped: unknown) => void
  onStatus: (handler: (...args: unknown[]) => void) => unknown
  offStatus: (wrapped: unknown) => void
  onNodeTouch: (handler: (...args: unknown[]) => void) => unknown
  offNodeTouch: (wrapped: unknown) => void
  onArtifactCreated: (handler: (...args: unknown[]) => void) => unknown
  offArtifactCreated: (wrapped: unknown) => void
}

interface Window {
  electronAPI: ElectronAPI
  orbiter: OrbiterAPI
}
