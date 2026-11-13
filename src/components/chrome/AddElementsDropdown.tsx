import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TerminalSquare, Globe, FileUp, AppWindow, ChevronRight, Settings } from 'lucide-react'
import { GlassMenu } from '../glass'
import { useCanvasStore, useSettingsStore, useHistoryStore } from '../../stores'
import type { NodeType } from '../../stores'

// Default sizes per node type
const DEFAULT_SIZES: Record<NodeType, { w: number; h: number }> = {
  terminal: { w: 680, h: 440 },
  browser: { w: 800, h: 560 },
  file: { w: 560, h: 400 },
  webapp: { w: 800, h: 560 },
  note: { w: 240, h: 200 },
}

let nodeCounter = 0

// File type to default size mapping
const FILE_TYPE_SIZES: Record<string, { w: number; h: number }> = {
  image: { w: 360, h: 360 },
  code: { w: 560, h: 400 },
  markdown: { w: 520, h: 400 },
  pdf: { w: 480, h: 640 },
  audio: { w: 320, h: 100 },
  video: { w: 560, h: 315 },
  unknown: { w: 200, h: 160 },
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])
const CODE_EXTS = new Set([
  'py',
  'js',
  'ts',
  'tsx',
  'jsx',
  'json',
  'yaml',
  'yml',
  'toml',
  'ini',
  'css',
  'scss',
  'html',
  'xml',
  'sql',
  'sh',
  'bash',
  'zsh',
  'fish',
  'c',
  'cpp',
  'h',
  'hpp',
  'java',
  'go',
  'rs',
  'rb',
  'php',
  'swift',
  'kt',
  'scala',
  'lua',
  'r',
  'pl',
  'ex',
  'exs',
  'clj',
  'hs',
  'vim',
  'el',
  'lisp',
  'dart',
  'zig',
  'nim',
  'v',
  'vue',
  'svelte',
  'txt',
  'log',
  'conf',
  'cfg',
  'env',
  'gitignore',
  'dockerfile',
  'makefile',
  'cmake',
])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'])

function getFileSizeForPath(filePath: string): { w: number; h: number } {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTS.has(ext)) return FILE_TYPE_SIZES.image
  if (ext === 'md' || ext === 'markdown') return FILE_TYPE_SIZES.markdown
  if (ext === 'pdf') return FILE_TYPE_SIZES.pdf
  if (AUDIO_EXTS.has(ext)) return FILE_TYPE_SIZES.audio
  if (VIDEO_EXTS.has(ext)) return FILE_TYPE_SIZES.video
  if (CODE_EXTS.has(ext)) return FILE_TYPE_SIZES.code
  return FILE_TYPE_SIZES.unknown
}

export function createNode(type: NodeType, extra: Record<string, unknown> = {}) {
  const store = useCanvasStore.getState()
  const maxZ = Math.max(0, ...store.nodes.map((n) => n.zIndex))
  nodeCounter += 1
  const id = `${nodeCounter}`

  const titles: Record<NodeType, string> = {
    terminal: 'Terminal',
    browser: 'Browser',
    file: 'File',
    webapp: 'Web App',
    note: 'Note',
  }

  // For file nodes, determine size based on file extension
  let size = DEFAULT_SIZES[type]
  if (type === 'file' && extra.filePath) {
    size = getFileSizeForPath(String(extra.filePath))
  }

  // Override size if explicitly provided
  if (extra.sizeOverride) {
    size = extra.sizeOverride as { w: number; h: number }
  }

  // Use explicit position if provided (e.g., drag-and-drop), otherwise center in viewport
  let x: number, y: number
  if (extra.positionOverride) {
    const pos = extra.positionOverride as { x: number; y: number }
    x = pos.x - size.w / 2
    y = pos.y - size.h / 2
  } else {
    const viewCenterX = window.innerWidth / 2
    const viewCenterY = window.innerHeight / 2
    x = (viewCenterX - store.panOffset.x) / store.zoom - size.w / 2
    y = (viewCenterY - store.panOffset.y) / store.zoom - size.h / 2
  }

  const node = {
    id,
    type,
    title: extra.title ? String(extra.title) : titles[type],
    position: { x, y },
    size,
    zIndex: maxZ + 1,
    metadata: { ...extra, createdAt: Date.now() },
  }

  store.addNode(node)

  // Track in undo history
  useHistoryStore.getState().pushAction({
    id: `h-${Date.now()}-add-${id}`,
    type: 'addNode',
    timestamp: Date.now(),
    description: `Add ${type} "${node.title}"`,
    undo: { type: 'addNode', nodeId: id, node },
    redo: { type: 'addNode', node },
  })

  return id
}

export function duplicateNode(sourceId: string): string | undefined {
  const store = useCanvasStore.getState()
  const source = store.nodes.find((n) => n.id === sourceId)
  if (!source) return undefined
  const maxZ = Math.max(0, ...store.nodes.map((n) => n.zIndex))
  nodeCounter += 1
  const newId = `${nodeCounter}`
  const newNode = {
    id: newId,
    type: source.type,
    title: source.title,
    position: { x: source.position.x + 40, y: source.position.y + 40 },
    size: { ...source.size },
    zIndex: maxZ + 1,
    metadata: { ...source.metadata, createdAt: Date.now() },
  }
  store.addNode(newNode)

  // Track in undo history
  useHistoryStore.getState().pushAction({
    id: `h-${Date.now()}-dup-${newId}`,
    type: 'addNode',
    timestamp: Date.now(),
    description: `Duplicate ${source.type} "${source.title}"`,
    undo: { type: 'addNode', nodeId: newId, node: newNode },
    redo: { type: 'addNode', node: newNode },
  })

  return newId
}

interface AddElementsDropdownProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLDivElement | null>
}

const SHORTCUT_BADGE_STYLE: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '2px 6px',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.06)',
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
}

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  onMouseEnter,
  onMouseLeave,
  trailing,
}: {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 36,
        padding: '0 10px',
        borderRadius: 8,
        border: 'none',
        background: 'transparent',
        color: 'var(--text-primary)',
        fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-body)',
        cursor: 'pointer',
        position: 'relative',
      }}
      className="glass-button"
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
      {shortcut && <span style={SHORTCUT_BADGE_STYLE}>{shortcut}</span>}
      {trailing}
    </button>
  )
}

export function AddElementsDropdown({ open, onClose, anchorRef }: AddElementsDropdownProps) {
  const [webAppSubOpen, setWebAppSubOpen] = useState(false)
  const webAppTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const webApps = useSettingsStore((s) => s.webApps)

  // Position dropdown below the anchor
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, left: rect.left })
    }
  }, [open, anchorRef])

  // Close on Esc
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Close on click-outside
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    // Delay listener to avoid closing from the same click that opened it
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [open, onClose, anchorRef])

  // Reset sub-menu when main menu closes
  useEffect(() => {
    if (!open) setWebAppSubOpen(false)
  }, [open])

  const handleAddTerminal = useCallback(() => {
    createNode('terminal')
    onClose()
  }, [onClose])

  const handleAddBrowser = useCallback(() => {
    createNode('browser')
    onClose()
  }, [onClose])

  const handleAddFile = useCallback(async () => {
    try {
      const filePath = (await window.electronAPI.invoke('dialog:openFile')) as string | null
      if (filePath) {
        const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'File'
        createNode('file', { filePath, title: fileName })
      }
    } catch {
      // No electron API available (running in browser); create placeholder file node
      createNode('file')
    }
    onClose()
  }, [onClose])

  const handleAddWebApp = useCallback(
    (app: { name: string; url: string }) => {
      createNode('webapp', {
        title: app.name,
        appName: app.name,
        lockedUrl: app.url,
      })
      onClose()
    },
    [onClose],
  )

  const showWebAppSub = useCallback(() => {
    if (webAppTimerRef.current) clearTimeout(webAppTimerRef.current)
    setWebAppSubOpen(true)
  }, [])

  const hideWebAppSub = useCallback(() => {
    webAppTimerRef.current = setTimeout(() => setWebAppSubOpen(false), 150)
  }, [])

  const cancelHideWebAppSub = useCallback(() => {
    if (webAppTimerRef.current) clearTimeout(webAppTimerRef.current)
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 2000,
          }}
        >
          <GlassMenu open={open} style={{ width: 220 }}>
            <MenuItem
              icon={<TerminalSquare size={18} strokeWidth={1.75} />}
              label="Terminal"
              shortcut="⌘T"
              onClick={handleAddTerminal}
            />
            <MenuItem
              icon={<Globe size={18} strokeWidth={1.75} />}
              label="Browser"
              shortcut="⌘B"
              onClick={handleAddBrowser}
            />
            <MenuItem
              icon={<FileUp size={18} strokeWidth={1.75} />}
              label="File"
              shortcut="⌘O"
              onClick={handleAddFile}
            />
            <div style={{ position: 'relative' }} onMouseEnter={showWebAppSub} onMouseLeave={hideWebAppSub}>
              <MenuItem
                icon={<AppWindow size={18} strokeWidth={1.75} />}
                label="Web App"
                shortcut="⌘W"
                onClick={showWebAppSub}
                trailing={
                  <ChevronRight
                    size={14}
                    strokeWidth={1.75}
                    style={{ color: 'var(--text-tertiary)', marginLeft: -4 }}
                  />
                }
              />

              {/* Web App sub-menu */}
              <AnimatePresence>
                {webAppSubOpen && (
                  <motion.div
                    className="glass"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ type: 'spring', duration: 0.2 }}
                    onMouseEnter={cancelHideWebAppSub}
                    onMouseLeave={hideWebAppSub}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '100%',
                      marginLeft: 4,
                      width: 200,
                      borderRadius: 14,
                      padding: 6,
                      maxHeight: 360,
                      overflowY: 'auto',
                      zIndex: 2001,
                    }}
                  >
                    {webApps.map((app, i) => (
                      <motion.div
                        key={app.name}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, type: 'spring', duration: 0.25 }}
                      >
                        <button
                          type="button"
                          onClick={() => handleAddWebApp(app)}
                          className="glass-button"
                          aria-label={app.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            height: 32,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            fontSize: 'var(--text-sm)',
                            fontFamily: 'var(--font-body)',
                            cursor: 'pointer',
                          }}
                        >
                          {app.name}
                        </button>
                      </motion.div>
                    ))}

                    {/* Configure Apps separator + link */}
                    <div
                      style={{
                        height: 1,
                        background: 'var(--glass-border)',
                        opacity: 0.3,
                        margin: '4px 0',
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: webApps.length * 0.03,
                        type: 'spring',
                        duration: 0.25,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          // Will open Settings → Web Apps section in a future story
                          onClose()
                        }}
                        className="glass-button"
                        aria-label="Configure Apps"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          height: 32,
                          padding: '0 10px',
                          borderRadius: 8,
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          fontSize: 'var(--text-sm)',
                          fontFamily: 'var(--font-body)',
                          cursor: 'pointer',
                        }}
                      >
                        <Settings size={14} strokeWidth={1.75} />
                        Configure Apps…
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassMenu>
        </div>
      )}
    </AnimatePresence>
  )
}
