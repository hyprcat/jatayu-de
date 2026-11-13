import { useState, useEffect, useCallback } from 'react'
import { useSettingsStore } from '../../stores'

interface ShortcutDef {
  action: string
  defaultBinding: string
  category: string
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
const MOD = isMac ? '⌘' : 'Ctrl+'

const SHORTCUTS: ShortcutDef[] = [
  // Global
  { action: 'Open Spotlight', defaultBinding: 'Super+Alt+Space', category: 'Global' },
  { action: 'New Terminal', defaultBinding: `${MOD}T`, category: 'Global' },
  { action: 'New Browser', defaultBinding: `${MOD}B`, category: 'Global' },
  { action: 'Open File', defaultBinding: `${MOD}O`, category: 'Global' },
  { action: 'Save Canvas', defaultBinding: `${MOD}S`, category: 'Global' },
  { action: 'Undo', defaultBinding: `${MOD}Z`, category: 'Global' },
  { action: 'Redo', defaultBinding: `${MOD}⇧Z`, category: 'Global' },
  { action: 'Toggle File Explorer', defaultBinding: `${MOD}⇧E`, category: 'Global' },
  { action: 'Toggle Agent Panel', defaultBinding: `${MOD}⇧A`, category: 'Global' },
  { action: 'Toggle Snap to Grid', defaultBinding: `${MOD}⇧G`, category: 'Global' },
  { action: 'Filter Nodes (Spotlight)', defaultBinding: `${MOD}⇧F`, category: 'Global' },
  { action: 'Zoom In', defaultBinding: `${MOD}+`, category: 'Global' },
  { action: 'Zoom Out', defaultBinding: `${MOD}-`, category: 'Global' },
  { action: 'Reset Zoom', defaultBinding: `${MOD}0`, category: 'Global' },

  // Canvas layer
  { action: 'Cycle Focus (Next)', defaultBinding: 'Tab', category: 'Canvas' },
  { action: 'Cycle Focus (Prev)', defaultBinding: '⇧Tab', category: 'Canvas' },
  { action: 'Jump to Node 1–9', defaultBinding: '1–9', category: 'Canvas' },
  { action: 'Select All', defaultBinding: `${MOD}A`, category: 'Canvas' },
  { action: 'Pan Up', defaultBinding: '↑', category: 'Canvas' },
  { action: 'Pan Down', defaultBinding: '↓', category: 'Canvas' },
  { action: 'Pan Left', defaultBinding: '←', category: 'Canvas' },
  { action: 'Pan Right', defaultBinding: '→', category: 'Canvas' },
  { action: 'Pan Fast', defaultBinding: '⇧+Arrow', category: 'Canvas' },

  // Node layer
  { action: 'Activate Node', defaultBinding: 'Enter', category: 'Node' },
  { action: 'Deactivate / Unfocus', defaultBinding: 'Esc', category: 'Node' },
  { action: 'Rename Node', defaultBinding: 'F2', category: 'Node' },
  { action: 'Close Node', defaultBinding: `${MOD}W`, category: 'Node' },
  { action: 'Duplicate Node', defaultBinding: `${MOD}D`, category: 'Node' },
  { action: 'Delete Node', defaultBinding: 'Delete', category: 'Node' },
  { action: 'Move Node', defaultBinding: 'Arrow keys', category: 'Node' },
  { action: 'Move Node Fast', defaultBinding: '⇧+Arrow', category: 'Node' },
  { action: 'Open Context Menu', defaultBinding: `${MOD}Enter`, category: 'Node' },
  { action: 'Send to Agent', defaultBinding: `${MOD}.`, category: 'Node' },
  { action: 'Open Agent Picker', defaultBinding: `${MOD}/`, category: 'Node' },

  // Panel layer
  { action: 'Navigate Up/Down', defaultBinding: '↑/↓', category: 'Panel' },
  { action: 'Open Item', defaultBinding: 'Enter', category: 'Panel' },
  { action: 'Close Panel', defaultBinding: 'Esc', category: 'Panel' },
]

function keyEventToLabel(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push(isMac ? '⌘' : 'Ctrl+')
  if (e.shiftKey) parts.push('⇧')
  if (e.altKey) parts.push('Alt+')
  if (!['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) {
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
  }
  return parts.join('')
}

interface KeyboardShortcutsTableProps {
  className?: string
}

export function KeyboardShortcutsTable({ className }: KeyboardShortcutsTableProps) {
  const customShortcuts = useSettingsStore((s) => s.keyboardShortcuts)
  const setKeyboardShortcut = useSettingsStore((s) => s.setKeyboardShortcut)
  const [rebindingAction, setRebindingAction] = useState<string | null>(null)

  const getBinding = useCallback(
    (action: string, defaultBinding: string) => {
      return customShortcuts[action] ?? defaultBinding
    },
    [customShortcuts],
  )

  // Capture next keypress when rebinding
  useEffect(() => {
    if (!rebindingAction) return

    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Esc cancels rebinding
      if (e.key === 'Escape') {
        setRebindingAction(null)
        return
      }

      // Don't rebind modifier-only presses
      if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return

      const label = keyEventToLabel(e)
      if (label) {
        setKeyboardShortcut(rebindingAction, label)
      }
      setRebindingAction(null)
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [rebindingAction, setKeyboardShortcut])

  const categories = [...new Set(SHORTCUTS.map((s) => s.category))]

  return (
    <div className={className} style={{ fontFamily: 'var(--font-body)' }}>
      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
              padding: '0 8px',
            }}
          >
            {cat} Layer
          </div>
          {SHORTCUTS.filter((s) => s.category === cat).map((shortcut) => {
            const isRebinding = rebindingAction === shortcut.action
            const binding = getBinding(shortcut.action, shortcut.defaultBinding)

            return (
              <div
                key={shortcut.action}
                onClick={() => setRebindingAction(shortcut.action)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setRebindingAction(shortcut.action)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isRebinding ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'background 150ms',
                }}
                className="file-tree-row"
                aria-label={`${shortcut.action}: ${binding}. Click to rebind.`}
              >
                <span
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {shortcut.action}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: isRebinding ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: isRebinding ? '1px solid var(--accent-blue)' : '1px solid transparent',
                    minWidth: 60,
                    textAlign: 'center',
                  }}
                >
                  {isRebinding ? 'Press key...' : binding}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Get all shortcut definitions for external consumers. */
export { SHORTCUTS }
export type { ShortcutDef }
