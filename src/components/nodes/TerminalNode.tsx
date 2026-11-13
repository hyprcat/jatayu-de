import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { SearchAddon } from '@xterm/addon-search'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useCanvasStore } from '../../stores'
import type { CanvasNode } from '../../stores'
import { registerTerminal, unregisterTerminal } from '../../lib/terminalRegistry'

interface TerminalNodeProps {
  node: CanvasNode
}

export function TerminalNode({ node }: TerminalNodeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchRef = useRef<SearchAddon | null>(null)
  const searchBarRef = useRef<HTMLInputElement>(null)
  const searchVisibleRef = useRef(false)
  const initializedRef = useRef(false)
  const searchBarContainerRef = useRef<HTMLDivElement>(null)

  // Initialize xterm.js and connect to PTY
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return
    initializedRef.current = true

    const term = new Terminal({
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      theme: {
        background: '#111113',
        foreground: '#e4e4e7',
        cursor: '#e4e4e7',
        selectionBackground: 'rgba(255,255,255,0.15)',
        black: '#18181b',
        red: '#FF453A',
        green: '#30D158',
        yellow: '#FF9F0A',
        blue: '#0A84FF',
        magenta: '#BF5AF2',
        cyan: '#64D2FF',
        white: '#e4e4e7',
        brightBlack: '#52525b',
        brightRed: '#FF6961',
        brightGreen: '#4ADE80',
        brightYellow: '#FBBF24',
        brightBlue: '#60A5FA',
        brightMagenta: '#D8B4FE',
        brightCyan: '#67E8F9',
        brightWhite: '#fafafa',
      },
    })

    termRef.current = term
    registerTerminal(node.id, term)

    // Load addons
    const fitAddon = new FitAddon()
    fitRef.current = fitAddon
    term.loadAddon(fitAddon)

    const searchAddon = new SearchAddon()
    searchRef.current = searchAddon
    term.loadAddon(searchAddon)

    // Open terminal in container
    term.open(containerRef.current)

    // Try loading WebGL addon (falls back to canvas renderer on failure)
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
      })
      term.loadAddon(webglAddon)
    } catch {
      // WebGL not available, use default canvas renderer
    }

    // Fit to container
    try {
      fitAddon.fit()
    } catch {
      // Container may not be visible yet
    }

    // Create PTY in main process
    const cols = term.cols
    const rows = term.rows
    const nodeId = node.id

    const api = window.electronAPI
    api.invoke('pty:create', nodeId, cols, rows).catch(() => {
      term.writeln('\r\n\x1b[31m[Error: Could not create terminal session]\x1b[0m')
    })

    // Renderer → Main: user input
    const onDataDisposable = term.onData((data: string) => {
      api.send('pty:input', nodeId, data)
    })

    // Main → Renderer: PTY output
    const dataListener = api.on(`pty:data:${nodeId}`, (data: unknown) => {
      term.write(data as string)
    })

    // PTY exit
    const exitListener = api.on(`pty:exit:${nodeId}`, () => {
      term.writeln('\r\n\x1b[2m[Session ended]\x1b[0m')
    })

    // OSC title change: update node title in canvasStore
    const titleDisposable = term.onTitleChange((title: string) => {
      if (title) {
        useCanvasStore.getState().updateNode(nodeId, { title })
      }
    })

    return () => {
      unregisterTerminal(nodeId)
      onDataDisposable.dispose()
      titleDisposable.dispose()
      if (dataListener) api.off(`pty:data:${nodeId}`, dataListener)
      if (exitListener) api.off(`pty:exit:${nodeId}`, exitListener)
      api.invoke('pty:destroy', nodeId).catch(() => {})
      term.dispose()
      termRef.current = null
      fitRef.current = null
      searchRef.current = null
      initializedRef.current = false
    }
  }, [node.id])

  // Re-fit terminal when node size changes
  useEffect(() => {
    const fit = fitRef.current
    if (!fit) return

    // Small delay to ensure the container has resized
    const timer = setTimeout(() => {
      try {
        fit.fit()
        const term = termRef.current
        if (term) {
          window.electronAPI.send('pty:resize', node.id, term.cols, term.rows)
        }
      } catch {
        // Ignore fit errors
      }
    }, 50)

    return () => clearTimeout(timer)
  }, [node.size.w, node.size.h, node.id])

  // Handle ⌘K clear and ⌘F search
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const meta = e.metaKey || e.ctrlKey

    // ⌘K — clear terminal
    if (meta && e.key === 'k') {
      e.preventDefault()
      e.stopPropagation()
      termRef.current?.clear()
      return
    }

    // ⌘F — toggle search
    if (meta && e.key === 'f') {
      e.preventDefault()
      e.stopPropagation()
      searchVisibleRef.current = !searchVisibleRef.current
      const container = searchBarContainerRef.current
      if (container) {
        container.style.display = searchVisibleRef.current ? 'flex' : 'none'
      }
      if (searchVisibleRef.current) {
        searchBarRef.current?.focus()
      } else {
        searchRef.current?.clearDecorations()
        termRef.current?.focus()
      }
      return
    }
  }, [])

  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    if (query) {
      searchRef.current?.findNext(query)
    } else {
      searchRef.current?.clearDecorations()
    }
  }, [])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      searchVisibleRef.current = false
      const container = searchBarContainerRef.current
      if (container) {
        container.style.display = 'none'
      }
      searchRef.current?.clearDecorations()
      termRef.current?.focus()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        searchRef.current?.findPrevious((e.target as HTMLInputElement).value)
      } else {
        searchRef.current?.findNext((e.target as HTMLInputElement).value)
      }
    }
  }, [])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#111113',
        overflow: 'hidden',
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Search bar */}
      <div
        ref={searchBarContainerRef}
        style={{
          display: 'none',
          position: 'absolute',
          top: 0,
          right: 0,
          zIndex: 10,
          padding: '4px 8px',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <input
          ref={searchBarRef}
          type="text"
          placeholder="Find..."
          onChange={handleSearchInput}
          onKeyDown={handleSearchKeyDown}
          style={{
            width: 180,
            height: 26,
            padding: '0 8px',
            border: '1px solid var(--glass-border)',
            borderRadius: 6,
            background: 'rgba(20,20,24,0.85)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
      </div>

      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          padding: '4px 0 0 4px',
        }}
      />
    </div>
  )
}
