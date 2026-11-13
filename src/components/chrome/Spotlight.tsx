import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, ArrowRight } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useUIStore, useCanvasStore, useAgentStore, useSettingsStore } from '../../stores'
import { GlassPanel } from '../glass'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { SEARCH_PREFIXES, type Suggestion, type WorkspaceFile } from './spotlightActions'
import { buildSuggestions, getPrefixLabel, sectionIcon } from './spotlightSuggestions'

export function Spotlight() {
  const open = useUIStore((s) => s.spotlightOpen)
  const setOpen = useUIStore((s) => s.setSpotlightOpen)

  return createPortal(
    <AnimatePresence>{open && <SpotlightOverlay key="spotlight" onClose={() => setOpen(false)} />}</AnimatePresence>,
    document.body,
  )
}

function SpotlightOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useFocusTrap(overlayRef, true)

  const nodes = useCanvasStore((s) => s.nodes)
  const canvases = useCanvasStore((s) => s.canvases)
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId)
  const agents = useAgentStore((s) => s.agents)
  const recentAgentIds = useAgentStore((s) => s.recentAgentIds)
  const workflows = useSettingsStore((s) => s.workflows)

  // Debounce query at 100ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 100)
    return () => clearTimeout(timer)
  }, [query])

  // Load workspace files on mount
  useEffect(() => {
    const loadFiles = async () => {
      try {
        if (!window.electronAPI) return
        const dir = useSettingsStore.getState().workspaceDir
        const result = (await window.electronAPI.invoke('fs:readDir', dir)) as {
          ok: boolean
          entries?: WorkspaceFile[]
        }
        if (result.ok && result.entries) {
          setWorkspaceFiles(result.entries.filter((e) => !e.isDirectory))
        }
      } catch {
        // No electron API or read failed
      }
    }
    loadFiles()
  }, [])

  // Listen for prefill events (e.g. ⌘⇧F → 'fw: ')
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text: string }
      if (detail.text) {
        setQuery(detail.text)
        // Move cursor to end
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(detail.text.length, detail.text.length)
          }
        })
      }
    }
    window.addEventListener('flow:spotlight-prefill', handler)
    return () => window.removeEventListener('flow:spotlight-prefill', handler)
  }, [])

  // Build suggestions from debounced query
  const suggestions = useMemo(
    () =>
      buildSuggestions(
        debouncedQuery,
        nodes,
        agents,
        recentAgentIds,
        workspaceFiles,
        workflows,
        canvases,
        activeCanvasId,
        onClose,
      ),
    [debouncedQuery, nodes, agents, recentAgentIds, workspaceFiles, workflows, canvases, activeCanvasId, onClose],
  )

  // Clamp selected index when suggestions change
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, suggestions.length - 1)))
  }, [suggestions.length])

  // Auto-focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('[data-spotlight-item]')
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const execute = useCallback(
    (index: number) => {
      const s = suggestions[index]
      if (!s) return

      // If suggestion has autocomplete, fill input instead of executing
      if (s.autocomplete) {
        setQuery(s.autocomplete)
        setSelectedIndex(0)
        // Move cursor to end
        setTimeout(() => {
          const el = inputRef.current
          if (el) {
            el.selectionStart = el.selectionEnd = s.autocomplete!.length
          }
        }, 0)
        return
      }

      s.action()
      onClose()
    },
    [suggestions, onClose],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // ⌘1–⌘9 executes Nth suggestion
      if (mod && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        execute(parseInt(e.key, 10) - 1)
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          execute(selectedIndex)
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab': {
          e.preventDefault()
          // Tab autocompletes agent names if available
          const s = suggestions[selectedIndex]
          if (s?.autocomplete) {
            setQuery(s.autocomplete)
            setSelectedIndex(0)
            setTimeout(() => {
              const el = inputRef.current
              if (el) {
                el.selectionStart = el.selectionEnd = s.autocomplete!.length
              }
            }, 0)
          }
          break
        }
      }
    },
    [suggestions, selectedIndex, execute, onClose],
  )

  // Click on backdrop closes
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose],
  )

  // Group suggestions by section
  const sections = useMemo(() => {
    const grouped: { name: string; items: (Suggestion & { globalIndex: number })[] }[] = []
    let currentSection = ''
    suggestions.forEach((s, i) => {
      if (s.section !== currentSection) {
        currentSection = s.section
        grouped.push({ name: currentSection, items: [] })
      }
      grouped[grouped.length - 1].items.push({ ...s, globalIndex: i })
    })
    return grouped
  }, [suggestions])

  // Derive placeholder from current prefix
  const placeholder = useMemo(() => {
    const q = query.trimStart()
    if (q.startsWith('@')) return 'Type agent name, then a prompt…'
    if (q.startsWith('run:')) return 'Run a saved workflow…'
    if (q.startsWith('w:')) return 'Go to node by ID or title…'
    if (q.startsWith('fw:')) return 'Filter canvas nodes…'
    if (q.startsWith('fc:')) return 'Switch canvas…'
    if (q.startsWith('a:')) return 'Add terminal, browser, file, or note…'
    if (q.startsWith('history:')) return 'Browse undo history…'
    for (const prefix of Object.keys(SEARCH_PREFIXES)) {
      if (q.startsWith(`${prefix}:`)) return `Search ${SEARCH_PREFIXES[prefix].name}…`
    }
    return 'Search, add, or ask an agent…'
  }, [query])

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Spotlight search"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '30vh',
        background: 'rgba(0, 0, 0, 0.40)',
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{
          type: 'spring',
          duration: reducedMotion ? 0 : 0.3,
          bounce: 0.1,
        }}
        style={{ width: 640 }}
      >
        <GlassPanel
          borderRadius={18}
          style={{
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.50), 0 8px 32px rgba(0,0,0,0.30)',
          }}
        >
          {/* Input area */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 20px',
            }}
          >
            <motion.div
              animate={reducedMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
            >
              <Search size={18} strokeWidth={1.75} style={{ color: 'var(--text-secondary)' }} />
            </motion.div>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              placeholder={placeholder}
              aria-label="Spotlight search"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-lg)',
                caretColor: 'var(--accent-blue)',
              }}
            />

            {/* Prefix hint badge */}
            {(query.trimStart().includes(':') || query.trimStart().startsWith('@')) && (
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-tertiary)',
                  background: 'var(--glass-active)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                {getPrefixLabel(query)}
              </span>
            )}
          </div>

          {/* Divider */}
          {suggestions.length > 0 && (
            <div
              style={{
                height: 1,
                background: 'var(--glass-border)',
                margin: '0 16px',
              }}
            />
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div
              ref={listRef}
              role="listbox"
              aria-label="Spotlight suggestions"
              style={{
                maxHeight: 360,
                overflowY: 'auto',
                padding: '8px 8px 8px',
              }}
            >
              {sections.map((section) => (
                <div key={section.name}>
                  {/* Section header */}
                  <div
                    style={{
                      padding: '8px 12px 4px',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {sectionIcon(section.name)}
                    {section.name}
                  </div>

                  {/* Items */}
                  {section.items.map((item) => (
                    <SpotlightRow
                      key={item.id}
                      suggestion={item}
                      selected={item.globalIndex === selectedIndex}
                      onHover={() => setSelectedIndex(item.globalIndex)}
                      onClick={() => execute(item.globalIndex)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {debouncedQuery.length > 0 && suggestions.length === 0 && (
            <div
              style={{
                padding: '24px 20px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
              }}
            >
              No results for &ldquo;{debouncedQuery}&rdquo;
            </div>
          )}
        </GlassPanel>
      </motion.div>
    </motion.div>
  )
}

// --- Suggestion row ---

function SpotlightRow({
  suggestion,
  selected,
  onHover,
  onClick,
}: {
  suggestion: Suggestion & { globalIndex: number }
  selected: boolean
  onHover: () => void
  onClick: () => void
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      data-spotlight-item
      onMouseEnter={onHover}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 40,
        padding: '0 12px',
        borderRadius: 10,
        cursor: 'pointer',
        background: selected ? 'var(--glass-hover)' : 'transparent',
        transition: 'background 100ms',
      }}
    >
      {/* Icon */}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}
      >
        {suggestion.icon}
      </span>

      {/* Label */}
      <span
        style={{
          flex: 1,
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-body)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {suggestion.label}
      </span>

      {/* Secondary text */}
      {suggestion.secondary && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-body)',
            color: 'var(--text-tertiary)',
            flexShrink: 0,
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {suggestion.secondary}
        </span>
      )}

      {/* Shortcut badge */}
      {suggestion.shortcut && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            background: 'var(--glass-active)',
            padding: '2px 6px',
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          {suggestion.shortcut}
        </span>
      )}

      {/* Arrow for navigable items */}
      {selected && <ArrowRight size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
    </div>
  )
}

// --- Section icons ---
