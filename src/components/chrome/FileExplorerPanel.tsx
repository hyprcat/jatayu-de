import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import { GlassButton, GlassInput } from '../glass'
import { useUIStore, useSettingsStore } from '../../stores'
import { createNode } from './AddElementsDropdown'

// --- Types ---

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

// --- File icon color helpers ---

const CODE_EXTS = new Set([
  'py',
  'js',
  'ts',
  'tsx',
  'jsx',
  'sh',
  'bash',
  'zsh',
  'c',
  'cpp',
  'h',
  'java',
  'go',
  'rs',
  'rb',
  'php',
  'swift',
  'css',
  'scss',
  'html',
  'xml',
  'sql',
  'vue',
  'svelte',
  'dart',
  'txt',
  'log',
  'makefile',
  'dockerfile',
])
const DATA_EXTS = new Set(['csv', 'json', 'tsv', 'yaml', 'yml', 'toml', 'ini', 'conf', 'xml'])
const MEDIA_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'mp3',
  'wav',
  'ogg',
  'flac',
  'mp4',
  'webm',
  'mov',
  'avi',
  'pdf',
])

function getFileIconColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (DATA_EXTS.has(ext)) return 'var(--accent-green)'
  if (MEDIA_EXTS.has(ext)) return 'var(--accent-purple)'
  if (CODE_EXTS.has(ext)) return 'var(--accent-blue)'
  return 'var(--text-tertiary)'
}

// --- IPC helpers ---

async function loadDirectory(dirPath: string): Promise<FileEntry[]> {
  try {
    const result = (await window.electronAPI.invoke('fs:readDir', dirPath)) as {
      ok: boolean
      entries?: FileEntry[]
    }
    if (result.ok && result.entries) return result.entries
  } catch {
    /* IPC unavailable */
  }
  return []
}

// --- FileExplorerPanel ---

export function FileExplorerPanel() {
  const isOpen = useUIStore((s) => s.fileExplorerOpen)
  const workspaceDir = useSettingsStore((s) => s.workspaceDir)

  const [rootEntries, setRootEntries] = useState<FileEntry[]>([])
  const [childrenMap, setChildrenMap] = useState<Record<string, FileEntry[]>>({})
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [panelWidth, setPanelWidth] = useState(280)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    entry: FileEntry
  } | null>(null)

  const resizingRef = useRef(false)

  // Load root directory + start watcher
  useEffect(() => {
    if (!isOpen) return
    loadDirectory(workspaceDir).then(setRootEntries)
    window.electronAPI?.invoke('fs:watch', workspaceDir)
    return () => {
      window.electronAPI?.invoke('fs:unwatch')
    }
  }, [isOpen, workspaceDir])

  // Listen for file system changes
  useEffect(() => {
    if (!isOpen || !window.electronAPI) return
    let debounce: ReturnType<typeof setTimeout> | null = null
    const handle = window.electronAPI.on('fs:change', () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        loadDirectory(workspaceDir).then(setRootEntries)
        expandedPaths.forEach((p) => {
          loadDirectory(p).then((children) => {
            setChildrenMap((prev) => ({ ...prev, [p]: children }))
          })
        })
      }, 300)
    })
    return () => {
      if (debounce) clearTimeout(debounce)
      if (handle) window.electronAPI.off('fs:change', handle)
    }
  }, [isOpen, workspaceDir, expandedPaths])

  // Reset state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSelectedIndex(-1)
      setContextMenu(null)
    }
  }, [isOpen])

  // Toggle folder expand/collapse
  const toggleFolder = useCallback(
    async (entry: FileEntry) => {
      const newExpanded = new Set(expandedPaths)
      if (newExpanded.has(entry.path)) {
        newExpanded.delete(entry.path)
      } else {
        newExpanded.add(entry.path)
        if (!childrenMap[entry.path]) {
          const children = await loadDirectory(entry.path)
          setChildrenMap((prev) => ({ ...prev, [entry.path]: children }))
        }
      }
      setExpandedPaths(newExpanded)
    },
    [expandedPaths, childrenMap],
  )

  // Flatten tree for rendering + search filtering
  const flatEntries = useMemo(() => {
    const result: { entry: FileEntry; depth: number }[] = []

    function walk(entries: FileEntry[], depth: number) {
      for (const entry of entries) {
        result.push({ entry, depth })
        if (entry.isDirectory && expandedPaths.has(entry.path)) {
          const children = childrenMap[entry.path]
          if (children) walk(children, depth + 1)
        }
      }
    }

    walk(rootEntries, 0)

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return result.filter(({ entry }) => entry.name.toLowerCase().includes(q))
    }

    return result
  }, [rootEntries, childrenMap, expandedPaths, searchQuery])

  // Keyboard navigation (↑/↓/Enter)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, flatEntries.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault()
        const item = flatEntries[selectedIndex]
        if (item) {
          if (item.entry.isDirectory) {
            toggleFolder(item.entry)
          } else {
            createNode('file', {
              filePath: item.entry.path,
              title: item.entry.name,
            })
          }
        }
      }
    },
    [flatEntries, selectedIndex, toggleFolder],
  )

  // Resize handle drag
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      resizingRef.current = true
      const startX = e.clientX
      const startWidth = panelWidth

      const onMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return
        setPanelWidth(Math.min(400, Math.max(220, startWidth + (ev.clientX - startX))))
      }
      const onUp = () => {
        resizingRef.current = false
        document.body.style.cursor = ''
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.body.style.cursor = 'col-resize'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [panelWidth],
  )

  // Drag start for file tree items
  const handleDragStart = useCallback((e: React.DragEvent, entry: FileEntry) => {
    e.dataTransfer.setData('text/plain', entry.path)
    e.dataTransfer.setData('application/x-flow-file', JSON.stringify({ path: entry.path, name: entry.name }))
    e.dataTransfer.effectAllowed = 'copy'
    useUIStore.getState().setIsDraggingFile(true)
  }, [])

  // Clear dragging state on drag end (listen globally)
  useEffect(() => {
    const handler = () => {
      useUIStore.getState().setIsDraggingFile(false)
    }
    window.addEventListener('dragend', handler)
    window.addEventListener('drop', handler)
    return () => {
      window.removeEventListener('dragend', handler)
      window.removeEventListener('drop', handler)
    }
  }, [])

  // Context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, entry })
  }, [])

  const handleOpen = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) {
        toggleFolder(entry)
      } else {
        createNode('file', { filePath: entry.path, title: entry.name })
      }
      setContextMenu(null)
    },
    [toggleFolder],
  )

  const handleCopyPath = useCallback((entry: FileEntry) => {
    navigator.clipboard.writeText(entry.path)
    setContextMenu(null)
  }, [])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          className="glass"
          onKeyDown={handleKeyDown}
          onFocus={() => useUIStore.getState().setFocusLayer('panel')}
          tabIndex={-1}
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            bottom: 16,
            width: panelWidth,
            zIndex: 500,
            borderRadius: '0 14px 14px 0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          role="tree"
          aria-label="File explorer"
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 12px 8px 16px',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}
            >
              FILES
            </span>
            <GlassButton
              aria-label="Close file explorer"
              onClick={() => useUIStore.getState().setFileExplorerOpen(false)}
            >
              <X size={16} strokeWidth={1.75} />
            </GlassButton>
          </div>

          {/* Search Input */}
          <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
            <GlassInput
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSelectedIndex(-1)
              }}
              aria-label="Search files"
            />
          </div>

          {/* File Tree */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '0 4px 12px',
            }}
            tabIndex={0}
          >
            {flatEntries.map(({ entry, depth }, index) => (
              <FileTreeRow
                key={entry.path}
                entry={entry}
                depth={depth}
                isExpanded={expandedPaths.has(entry.path)}
                isSelected={index === selectedIndex}
                onToggle={() => toggleFolder(entry)}
                onClick={() => {
                  setSelectedIndex(index)
                  if (!entry.isDirectory) {
                    createNode('file', {
                      filePath: entry.path,
                      title: entry.name,
                    })
                  }
                }}
                onDragStart={(e) => handleDragStart(e, entry)}
                onContextMenu={(e) => handleContextMenu(e, entry)}
              />
            ))}

            {flatEntries.length === 0 && (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {searchQuery ? 'No files match' : 'No files found'}
              </div>
            )}
          </div>

          {/* Resize Handle */}
          <div
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute',
              top: 0,
              right: -3,
              bottom: 0,
              width: 6,
              cursor: 'col-resize',
              zIndex: 10,
            }}
          />

          {/* Context Menu */}
          {contextMenu && (
            <FileContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              entry={contextMenu.entry}
              onOpen={() => handleOpen(contextMenu.entry)}
              onCopyPath={() => handleCopyPath(contextMenu.entry)}
              onDelete={() => setContextMenu(null)}
              onRename={() => setContextMenu(null)}
              onClose={() => setContextMenu(null)}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- File Tree Row ---

function FileTreeRow({
  entry,
  depth,
  isExpanded,
  isSelected,
  onToggle,
  onClick,
  onDragStart,
  onContextMenu,
}: {
  entry: FileEntry
  depth: number
  isExpanded: boolean
  isSelected: boolean
  onToggle: () => void
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const iconColor = entry.isDirectory ? 'var(--text-secondary)' : getFileIconColor(entry.name)

  return (
    <div
      draggable={!entry.isDirectory}
      onDragStart={onDragStart}
      onContextMenu={onContextMenu}
      onClick={(e) => {
        e.stopPropagation()
        if (entry.isDirectory) {
          onToggle()
        } else {
          onClick()
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        width: '100%',
        height: 28,
        paddingLeft: 8 + depth * 16,
        paddingRight: 8,
        borderRadius: 6,
        cursor: 'pointer',
        background: isSelected ? 'var(--glass-hover)' : 'transparent',
        color: 'var(--text-primary)',
        fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-body)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        border: 'none',
      }}
      className="file-tree-row"
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={entry.isDirectory ? isExpanded : undefined}
      aria-label={`${entry.isDirectory ? 'Folder' : 'File'}: ${entry.name}`}
    >
      {/* Chevron for directories */}
      {entry.isDirectory ? (
        isExpanded ? (
          <ChevronDown size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        ) : (
          <ChevronRight size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        )
      ) : (
        <span style={{ width: 14, flexShrink: 0 }} />
      )}

      {/* Icon */}
      {entry.isDirectory ? (
        <Folder size={15} strokeWidth={1.75} style={{ color: iconColor, flexShrink: 0 }} />
      ) : (
        <File size={15} strokeWidth={1.75} style={{ color: iconColor, flexShrink: 0 }} />
      )}

      {/* Name */}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
    </div>
  )
}

// --- Context Menu ---

function FileContextMenu({
  x,
  y,
  entry,
  onOpen,
  onCopyPath,
  onDelete,
  onRename,
  onClose,
}: {
  x: number
  y: number
  entry: FileEntry
  onOpen: () => void
  onCopyPath: () => void
  onDelete: () => void
  onRename: () => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick)
    }, 0)
    window.addEventListener('keydown', handleEsc)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const items = [
    { label: 'Open', action: onOpen },
    { label: 'Rename', action: onRename },
    { label: 'Delete', action: onDelete },
    { label: 'Copy Path', action: onCopyPath },
  ]

  // Clamp to viewport
  const menuWidth = 140
  const menuHeight = items.length * 32 + 8
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8)

  return createPortal(
    <motion.div
      ref={menuRef}
      className="glass"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', duration: 0.2 }}
      style={{
        position: 'fixed',
        top: clampedY,
        left: clampedX,
        zIndex: 3000,
        borderRadius: 10,
        padding: 4,
        minWidth: menuWidth,
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.action}
          aria-label={item.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            height: 32,
            padding: '0 10px',
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: item.label === 'Delete' ? 'var(--accent-red)' : 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
          }}
          className="glass-button"
        >
          {item.label}
        </button>
      ))}
    </motion.div>,
    document.body,
  )
}
