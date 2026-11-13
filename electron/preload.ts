import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, wrappedListener)
    return wrappedListener
  },
  off: (channel: string, wrappedListener: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, wrappedListener as (...args: unknown[]) => void)
  },
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
})

// --- Orbiter API ---

function wrapOrbiterListener(channel: string, handler: (...args: unknown[]) => void) {
  const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => handler(...args)
  ipcRenderer.on(channel, wrapped)
  return wrapped
}

contextBridge.exposeInMainWorld('orbiter', {
  agent: {
    list: () => ipcRenderer.invoke('orbiter:agent.list'),
    run: (name: string, input: string, context: unknown) =>
      ipcRenderer.invoke('orbiter:agent.run', name, input, context),
    stream: (name: string, input: string, context: unknown) =>
      ipcRenderer.invoke('orbiter:agent.stream', name, input, context),
    status: (name: string) => ipcRenderer.invoke('orbiter:agent.status', name),
    stop: (name: string) => ipcRenderer.invoke('orbiter:agent.stop', name),
  },
  status: () => ipcRenderer.invoke('orbiter:status'),
  restart: (orbiterPath: string) => ipcRenderer.invoke('orbiter:restart', orbiterPath),
  spawn: (orbiterPath: string) => ipcRenderer.invoke('orbiter:spawn', orbiterPath),
  onStreamChunk: (handler: (...args: unknown[]) => void) => wrapOrbiterListener('orbiter:stream-chunk', handler),
  offStreamChunk: (wrapped: (...args: unknown[]) => void) =>
    ipcRenderer.removeListener('orbiter:stream-chunk', wrapped),
  onStatus: (handler: (...args: unknown[]) => void) => wrapOrbiterListener('orbiter:status', handler),
  offStatus: (wrapped: (...args: unknown[]) => void) => ipcRenderer.removeListener('orbiter:status', wrapped),
  onNodeTouch: (handler: (...args: unknown[]) => void) => wrapOrbiterListener('orbiter:node-touch', handler),
  offNodeTouch: (wrapped: (...args: unknown[]) => void) => ipcRenderer.removeListener('orbiter:node-touch', wrapped),
  onArtifactCreated: (handler: (...args: unknown[]) => void) =>
    wrapOrbiterListener('orbiter:artifact-created', handler),
  offArtifactCreated: (wrapped: (...args: unknown[]) => void) =>
    ipcRenderer.removeListener('orbiter:artifact-created', wrapped),
})
