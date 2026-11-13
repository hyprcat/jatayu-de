import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
  WebContentsView,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn, type ChildProcess } from 'node:child_process'
import pty from 'node-pty'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let mainWindow: BrowserWindow | null = null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Flow',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0A0A0C',
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'))
  }
}

let tray: Tray | null = null

app.on('window-all-closed', () => {
  // On macOS, apps stay alive in the menu bar by convention
  // On Windows/Linux, keep alive in tray (don't quit)
  mainWindow = null
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// --- Browser View Management ---

const browserViews = new Map<string, WebContentsView>()

// --- PTY Management ---

const ptyProcesses = new Map<string, pty.IPty>()

function getDefaultShell(): string {
  if (process.platform === 'win32') return 'powershell.exe'
  return process.env.SHELL || '/bin/bash'
}

// --- IPC Handlers ---

ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('clipboard:readText', () => {
  return clipboard.readText()
})

ipcMain.handle('clipboard:hasImage', () => {
  const img = clipboard.readImage()
  return !img.isEmpty()
})

ipcMain.handle('clipboard:saveImage', async (_event, destDir: string) => {
  const img = clipboard.readImage()
  if (img.isEmpty()) return null
  const png = img.toPNG()
  const timestamp = Date.now()
  const fileName = `clipboard-${timestamp}.png`
  const dirPath = destDir.startsWith('~') ? path.join(app.getPath('home'), destDir.slice(1)) : destDir
  fs.mkdirSync(dirPath, { recursive: true })
  const filePath = path.join(dirPath, fileName)
  fs.writeFileSync(filePath, png)
  return filePath
})

ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  await shell.openExternal(url)
})

ipcMain.handle('shell:trashItem', async (_event, filePath: string) => {
  try {
    await shell.trashItem(filePath)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// --- PTY IPC Handlers ---

ipcMain.handle('pty:create', (_event, nodeId: string, cols: number, rows: number) => {
  if (ptyProcesses.has(nodeId)) return { ok: true }

  const shellPath = getDefaultShell()
  const ptyProc = pty.spawn(shellPath, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.env.HOME || process.cwd(),
    env: process.env as Record<string, string>,
  })

  ptyProcesses.set(nodeId, ptyProc)

  ptyProc.onData((data: string) => {
    mainWindow?.webContents.send(`pty:data:${nodeId}`, data)
  })

  ptyProc.onExit(({ exitCode }: { exitCode: number }) => {
    ptyProcesses.delete(nodeId)
    mainWindow?.webContents.send(`pty:exit:${nodeId}`, exitCode)
  })

  return { ok: true }
})

ipcMain.on('pty:input', (_event, nodeId: string, data: string) => {
  ptyProcesses.get(nodeId)?.write(data)
})

ipcMain.on('pty:resize', (_event, nodeId: string, cols: number, rows: number) => {
  try {
    ptyProcesses.get(nodeId)?.resize(cols, rows)
  } catch {
    // Ignore resize errors on dead PTY
  }
})

ipcMain.handle('pty:destroy', (_event, nodeId: string) => {
  const proc = ptyProcesses.get(nodeId)
  if (proc) {
    proc.kill()
    ptyProcesses.delete(nodeId)
  }
  return { ok: true }
})

// --- Browser View IPC Handlers ---

ipcMain.handle('browser:create', (_event, nodeId: string) => {
  if (!mainWindow) return { ok: false }
  if (browserViews.has(nodeId)) return { ok: true }

  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  })

  browserViews.set(nodeId, view)
  mainWindow.contentView.addChildView(view)
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })

  // Forward page events to renderer
  view.webContents.on('page-title-updated', (_e, title) => {
    mainWindow?.webContents.send(`browser:title-updated:${nodeId}`, title)
  })

  const sendNavState = () => {
    const url = view.webContents.getURL()
    mainWindow?.webContents.send(`browser:url-updated:${nodeId}`, url)
    mainWindow?.webContents.send(`browser:nav-state:${nodeId}`, view.webContents.canGoBack())
  }

  view.webContents.on('did-navigate', sendNavState)
  view.webContents.on('did-navigate-in-page', sendNavState)

  // Construct a CDP debug URL using webContents ID
  const cdpUrl = `cdp://webcontents/${view.webContents.id}`

  return { ok: true, cdpUrl }
})

ipcMain.handle('browser:navigate', (_event, nodeId: string, url: string) => {
  const view = browserViews.get(nodeId)
  if (!view) return { ok: false }
  let normalizedUrl = url
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl
  }
  view.webContents.loadURL(normalizedUrl)
  return { ok: true }
})

ipcMain.handle('browser:goBack', (_event, nodeId: string) => {
  const view = browserViews.get(nodeId)
  if (view?.webContents.canGoBack()) {
    view.webContents.goBack()
  }
  return { ok: true }
})

ipcMain.handle('browser:reload', (_event, nodeId: string) => {
  browserViews.get(nodeId)?.webContents.reload()
  return { ok: true }
})

ipcMain.handle('browser:destroy', (_event, nodeId: string) => {
  const view = browserViews.get(nodeId)
  if (view && mainWindow) {
    mainWindow.contentView.removeChildView(view)
    view.webContents.close()
    browserViews.delete(nodeId)
  }
  webappLockedDomains.delete(nodeId)
  return { ok: true }
})

ipcMain.on(
  'browser:setBounds',
  (_event, nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => {
    const view = browserViews.get(nodeId)
    if (!view) return
    view.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height)),
    })
  },
)

ipcMain.on('browser:focus', (_event, nodeId: string) => {
  const view = browserViews.get(nodeId)
  if (view && mainWindow) {
    // Re-add to bring to top of the native view stack
    mainWindow.contentView.removeChildView(view)
    mainWindow.contentView.addChildView(view)
  }
})

// --- Web App IPC Handlers ---

// Track locked domains for webapp nodes
const webappLockedDomains = new Map<string, string>()

ipcMain.handle('webapp:create', (_event, nodeId: string, lockedUrl: string) => {
  if (!mainWindow) return { ok: false }
  if (browserViews.has(nodeId)) return { ok: true }

  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  })

  browserViews.set(nodeId, view)
  mainWindow.contentView.addChildView(view)
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })

  // Determine the locked domain from the URL
  let lockedDomain = ''
  try {
    lockedDomain = new URL(lockedUrl).hostname
  } catch {
    // Fall back to raw URL if parsing fails
  }
  webappLockedDomains.set(nodeId, lockedDomain)

  // Intercept navigation to external domains
  view.webContents.on('will-navigate', (e, url) => {
    try {
      const targetDomain = new URL(url).hostname
      const locked = webappLockedDomains.get(nodeId) || ''
      // Allow same domain and subdomains
      if (locked && !targetDomain.endsWith(locked) && targetDomain !== locked) {
        e.preventDefault()
        mainWindow?.webContents.send(`webapp:external-nav:${nodeId}`, url)
      }
    } catch {
      // Invalid URL — allow navigation
    }
  })

  // Intercept new window requests (target="_blank" links etc.)
  view.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const targetDomain = new URL(url).hostname
      const locked = webappLockedDomains.get(nodeId) || ''
      if (locked && !targetDomain.endsWith(locked) && targetDomain !== locked) {
        mainWindow?.webContents.send(`webapp:external-nav:${nodeId}`, url)
        return { action: 'deny' }
      }
    } catch {
      // Invalid URL
    }
    // Same domain new windows: navigate in the same view
    view.webContents.loadURL(url)
    return { action: 'deny' }
  })

  // Forward page events
  view.webContents.on('page-title-updated', (_e, title) => {
    mainWindow?.webContents.send(`browser:title-updated:${nodeId}`, title)
  })

  // Construct CDP debug URL
  const cdpUrl = `cdp://webcontents/${view.webContents.id}`

  // Navigate to locked URL
  let normalizedUrl = lockedUrl
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl
  }
  view.webContents.loadURL(normalizedUrl)

  return { ok: true, cdpUrl }
})

// --- File IPC Handlers ---

ipcMain.handle('file:readText', async (_event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    // Limit to 50KB for canvas display
    return { ok: true, content: content.slice(0, 50000) }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('file:stat', async (_event, filePath: string) => {
  try {
    const stat = await fs.promises.stat(filePath)
    return {
      ok: true,
      size: stat.size,
      modifiedMs: stat.mtimeMs,
      isDirectory: stat.isDirectory(),
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('file:writeText', async (_event, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('file:readBase64', async (_event, filePath: string) => {
  try {
    const buf = await fs.promises.readFile(filePath)
    return { ok: true, data: buf.toString('base64'), size: buf.length }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// --- File Explorer IPC Handlers ---

let fsWatcher: fs.FSWatcher | null = null

function resolveHomePath(dirPath: string): string {
  return dirPath.startsWith('~') ? path.join(process.env.HOME || '', dirPath.slice(1)) : dirPath
}

ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
  try {
    const resolved = resolveHomePath(dirPath)
    const entries = await fs.promises.readdir(resolved, { withFileTypes: true })
    const result = entries
      .filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      .map((e) => ({
        name: e.name,
        path: path.join(resolved, e.name),
        isDirectory: e.isDirectory(),
      }))
    return { ok: true, entries: result }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('fs:watch', (_event, dirPath: string) => {
  if (fsWatcher) {
    fsWatcher.close()
    fsWatcher = null
  }

  const resolved = resolveHomePath(dirPath)

  try {
    fsWatcher = fs.watch(resolved, { recursive: true }, (_eventType, filename) => {
      if (filename && !String(filename).startsWith('.')) {
        mainWindow?.webContents.send('fs:change', { path: path.join(resolved, String(filename)) })
      }
    })
    fsWatcher.on('error', () => {
      // Silently ignore watcher errors (e.g., directory removed)
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('fs:unwatch', () => {
  if (fsWatcher) {
    fsWatcher.close()
    fsWatcher = null
  }
  return { ok: true }
})

// --- Canvas Save / Restore IPC Handlers ---

ipcMain.handle('canvas:save', async (_event, canvasId: string, name: string, jsonContent: string) => {
  try {
    const homeDir = app.getPath('home')
    const canvasDir = path.join(homeDir, 'Flow', 'canvases', canvasId)
    fs.mkdirSync(canvasDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${name}-${timestamp}.json`
    const filePath = path.join(canvasDir, fileName)
    await fs.promises.writeFile(filePath, jsonContent, 'utf-8')
    return { ok: true, filePath }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('canvas:listSnapshots', async (_event, canvasId: string) => {
  try {
    const homeDir = app.getPath('home')
    const canvasDir = path.join(homeDir, 'Flow', 'canvases', canvasId)
    // Ensure directory exists
    fs.mkdirSync(canvasDir, { recursive: true })
    const files = await fs.promises.readdir(canvasDir)
    const snapshots: { name: string; filePath: string; timestamp: number; nodeCount: number; isAuto: boolean }[] = []
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const filePath = path.join(canvasDir, file)
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8')
        const data = JSON.parse(content)
        snapshots.push({
          name: data.name || file.replace('.json', ''),
          filePath,
          timestamp: data.timestamp || 0,
          nodeCount: Array.isArray(data.nodes) ? data.nodes.length : 0,
          isAuto: file.startsWith('auto-'),
        })
      } catch {
        // Skip invalid JSON files
      }
    }
    // Sort by timestamp descending (newest first)
    snapshots.sort((a, b) => b.timestamp - a.timestamp)
    return { ok: true, snapshots }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('canvas:loadSnapshot', async (_event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// --- Orbiter Management ---

let orbiterProcess: ChildProcess | null = null
let orbiterStatus: 'running' | 'stopped' | 'error' = 'stopped'
let orbiterError = ''
let rpcIdCounter = 0
const pendingRequests = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>()
let orbiterBuffer = ''

function handleOrbiterMessage(msg: Record<string, unknown>) {
  const id = msg.id as number | undefined

  // Response to a pending request
  if (id !== undefined && pendingRequests.has(id)) {
    const pending = pendingRequests.get(id)!
    pendingRequests.delete(id)
    if (msg.error) {
      const errObj = msg.error as Record<string, unknown>
      pending.reject(new Error((errObj.message as string) || 'Orbiter RPC error'))
    } else {
      pending.resolve(msg.result)
    }
    return
  }

  // Streaming notification (no id, has method)
  const method = msg.method as string | undefined
  if (method === 'stream.chunk') {
    mainWindow?.webContents.send('orbiter:stream-chunk', msg.params)
  } else if (method === 'node.touch') {
    mainWindow?.webContents.send('orbiter:node-touch', msg.params)
  } else if (method === 'artifact.created') {
    // Save artifact to ~/Flow/artifacts/[agentName]/[timestamp]/
    const params = msg.params as Record<string, unknown> | undefined
    if (params?.filePath) {
      const agentName = (params.agentName as string) || 'unknown'
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = path.basename(params.filePath as string)
      const homeDir = app.getPath('home')
      const artifactDir = path.join(homeDir, 'Flow', 'artifacts', agentName, timestamp)
      try {
        fs.mkdirSync(artifactDir, { recursive: true })
        const destPath = path.join(artifactDir, fileName)
        fs.copyFileSync(params.filePath as string, destPath)
        // Forward with the saved path
        mainWindow?.webContents.send('orbiter:artifact-created', {
          ...params,
          filePath: destPath,
        })
      } catch {
        // If save fails, forward original path
        mainWindow?.webContents.send('orbiter:artifact-created', params)
      }
    } else {
      mainWindow?.webContents.send('orbiter:artifact-created', msg.params)
    }
  }
}

function sendOrbiterRequest(method: string, params: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!orbiterProcess || orbiterStatus !== 'running') {
      reject(new Error('Orbiter is not running'))
      return
    }

    const id = ++rpcIdCounter
    const request = JSON.stringify({ jsonrpc: '2.0', method, params, id }) + '\n'

    pendingRequests.set(id, { resolve, reject })

    orbiterProcess.stdin?.write(request, (err) => {
      if (err) {
        pendingRequests.delete(id)
        reject(err)
      }
    })
  })
}

function spawnOrbiter(orbiterPath: string) {
  // Kill existing process if any
  if (orbiterProcess) {
    orbiterProcess.kill()
    orbiterProcess = null
  }

  orbiterStatus = 'stopped'
  orbiterError = ''
  orbiterBuffer = ''

  const parts = orbiterPath.split(/\s+/)
  const cmd = parts[0]
  const args = parts.slice(1)

  try {
    orbiterProcess = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    orbiterProcess.stdout?.on('data', (chunk: Buffer) => {
      orbiterBuffer += chunk.toString()
      // Process complete JSON-RPC lines (newline-delimited)
      let nlIndex: number
      while ((nlIndex = orbiterBuffer.indexOf('\n')) !== -1) {
        const line = orbiterBuffer.slice(0, nlIndex).trim()
        orbiterBuffer = orbiterBuffer.slice(nlIndex + 1)
        if (!line) continue
        try {
          const msg = JSON.parse(line) as Record<string, unknown>
          handleOrbiterMessage(msg)
        } catch {
          // Ignore non-JSON output
        }
      }
    })

    orbiterProcess.stderr?.on('data', (chunk: Buffer) => {
      console.error('[Orbiter stderr]', chunk.toString())
    })

    orbiterProcess.on('error', (err) => {
      orbiterStatus = 'error'
      orbiterError = err.message
      orbiterProcess = null
      mainWindow?.webContents.send('orbiter:status', {
        status: 'error',
        error: err.message,
      })
    })

    orbiterProcess.on('exit', (code) => {
      orbiterStatus = 'stopped'
      orbiterProcess = null
      // Reject all pending requests
      for (const [id, pending] of pendingRequests) {
        pending.reject(new Error('Orbiter process exited'))
        pendingRequests.delete(id)
      }
      mainWindow?.webContents.send('orbiter:status', {
        status: 'stopped',
        code,
      })
    })

    orbiterStatus = 'running'
    mainWindow?.webContents.send('orbiter:status', { status: 'running' })
  } catch (err) {
    orbiterStatus = 'error'
    orbiterError = String(err)
    mainWindow?.webContents.send('orbiter:status', {
      status: 'error',
      error: String(err),
    })
  }
}

// --- Orbiter IPC Handlers ---

ipcMain.handle('orbiter:agent.list', async () => {
  try {
    return { ok: true, result: await sendOrbiterRequest('agent.list', {}) }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('orbiter:agent.run', async (_event, name: string, input: string, context: unknown) => {
  try {
    return {
      ok: true,
      result: await sendOrbiterRequest('agent.run', { name, input, context }),
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('orbiter:agent.stream', async (_event, name: string, input: string, context: unknown) => {
  try {
    return {
      ok: true,
      result: await sendOrbiterRequest('agent.stream', { name, input, context }),
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('orbiter:agent.status', async (_event, name: string) => {
  try {
    return { ok: true, result: await sendOrbiterRequest('agent.status', { name }) }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('orbiter:agent.stop', async (_event, name: string) => {
  try {
    return { ok: true, result: await sendOrbiterRequest('agent.stop', { name }) }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('orbiter:status', () => {
  return { status: orbiterStatus, error: orbiterError }
})

ipcMain.handle('orbiter:restart', (_event, orbiterPath: string) => {
  spawnOrbiter(orbiterPath)
  return { status: orbiterStatus, error: orbiterError }
})

ipcMain.handle('orbiter:spawn', (_event, orbiterPath: string) => {
  spawnOrbiter(orbiterPath)
  return { status: orbiterStatus, error: orbiterError }
})

// --- Cleanup ---

app.on('before-quit', () => {
  // Kill Orbiter
  if (orbiterProcess) {
    orbiterProcess.kill()
    orbiterProcess = null
  }
  for (const [id, pending] of pendingRequests) {
    pending.reject(new Error('App is quitting'))
    pendingRequests.delete(id)
  }

  for (const [, proc] of ptyProcesses) {
    proc.kill()
  }
  ptyProcesses.clear()

  for (const [, view] of browserViews) {
    view.webContents.close()
  }
  browserViews.clear()
  webappLockedDomains.clear()

  if (fsWatcher) {
    fsWatcher.close()
    fsWatcher = null
  }

  globalShortcut.unregisterAll()
})

// --- Deep Link Protocol ---

const PROTOCOL = 'flow'

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL)
}

function handleDeepLink(url: string) {
  if (!url.startsWith(`${PROTOCOL}://`)) return
  const parsed = new URL(url)
  const pathParts = parsed.pathname.replace(/^\/+/, '').split('/')

  if (pathParts[0] === 'canvas' && pathParts[1]) {
    // flow://canvas/[name] → switch canvas
    mainWindow?.webContents.send('deeplink:canvas', pathParts[1])
  } else if (pathParts[0] === 'agent' && pathParts[1]) {
    // flow://agent/[name]?prompt=[text] → open agent with prompt
    const prompt = parsed.searchParams.get('prompt') || ''
    mainWindow?.webContents.send('deeplink:agent', pathParts[1], prompt)
  }

  // Show and focus window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
}

// macOS: open-url event
app.on('open-url', (_event, url) => {
  handleDeepLink(url)
})

// Windows/Linux: second-instance carries the URL
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // The deep link URL is in argv
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (url) handleDeepLink(url)

    // Focus existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// --- File Association IPC ---

ipcMain.handle('app:setFileAssociations', (_event, enabled: boolean) => {
  if (enabled) {
    // Register as handler for common code/config file types
    for (const ext of ['py', 'ts', 'js', 'md', 'json', 'yaml']) {
      try {
        app.setAsDefaultProtocolClient(`file-${ext}`)
      } catch {
        // Not all platforms support this
      }
    }
  }
  return { ok: true }
})

// --- OS File Drag-and-Drop ---

ipcMain.on('os:file-drop', (_event, filePaths: string[]) => {
  // Forward to renderer for node creation
  mainWindow?.webContents.send('os:file-drop', filePaths)
})

function createTray() {
  // Create a 16x16 template tray icon
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAYklEQVQ4T2NkoBAwUqifAa8BDGhmO' +
        'DAMGAIuMDAwPKBkEEIbwMDAoMHAwHCfYgMYGBj+MzAwSFBsAAPD/v8MDAxmFBvAwJD9n4GBwZxi' +
        'AxgY3v9nYGCQoNgABob//xkYGNQBnQoYEaVX9eAAAAAASUVORK5CYII=',
      'base64',
    ),
  )
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('Flow')

  const updateTrayMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Flow', type: 'normal', enabled: false },
      { type: 'separator' },
      {
        label: 'Open Flow',
        click: () => {
          if (mainWindow) {
            mainWindow.show()
            mainWindow.focus()
          } else {
            createWindow()
          }
        },
      },
      {
        label: 'Quick Note',
        click: () => {
          if (!mainWindow) createWindow()
          mainWindow?.webContents.send('tray:quick-note')
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit()
        },
      },
    ])
    tray?.setContextMenu(contextMenu)
  }

  updateTrayMenu()

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  createTray()

  // Register global Spotlight shortcut: Super+Alt+Space
  globalShortcut.register('Super+Alt+Space', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('spotlight:toggle')
    }
  })

  // Handle OS file drag-and-drop onto the window
  if (mainWindow) {
    mainWindow.webContents.on('will-navigate', (e) => {
      // Prevent file drops from navigating
      e.preventDefault()
    })
  }
})
