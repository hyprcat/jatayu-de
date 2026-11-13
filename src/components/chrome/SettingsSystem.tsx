import { useState, useCallback, useEffect } from 'react'
import { Trash2, Download, Upload, RotateCw } from 'lucide-react'
import { GlassInput } from '../glass'
import { KeyboardShortcutsTable } from './KeyboardShortcutsTable'
import { OrbiterStatus } from './OrbiterStatus'
import { useUIStore, useSettingsStore, useCanvasStore } from '../../stores'
import { serializeCanvas } from '../../lib/canvasSave'
import { LABEL_STYLE, SECTION_TITLE } from './settingsShared'

export function KeyboardSection() {
  return (
    <div>
      <div style={SECTION_TITLE}>Keyboard Shortcuts</div>
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          marginBottom: 12,
        }}
      >
        Click a shortcut to rebind it. Press Esc to cancel.
      </div>
      <KeyboardShortcutsTable />
    </div>
  )
}

export function OrbiterSection() {
  const orbiterPath = useSettingsStore((s) => s.orbiterPath)
  const setOrbiterPath = useSettingsStore((s) => s.setOrbiterPath)

  return (
    <div>
      <div style={SECTION_TITLE}>Orbiter</div>

      {/* Status */}
      <div style={{ marginBottom: 20 }}>
        <div style={LABEL_STYLE}>Runtime Status</div>
        <OrbiterStatus />
      </div>

      {/* Python Path */}
      <div style={{ marginBottom: 20 }}>
        <div style={LABEL_STYLE}>Orbiter Command</div>
        <GlassInput
          value={orbiterPath}
          onChange={(e) => setOrbiterPath(e.target.value)}
          aria-label="Orbiter command"
          style={{ width: '100%', maxWidth: 400 }}
        />
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            marginTop: 4,
          }}
        >
          Command to start the Orbiter agent runtime (e.g. &quot;python3 -m orbiter&quot;)
        </div>
      </div>

      {/* Restart */}
      <button
        type="button"
        onClick={() => {
          if (window.orbiter) {
            window.orbiter.restart(orbiterPath)
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 8,
          border: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)',
          color: 'var(--text-primary)',
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        <RotateCw size={14} strokeWidth={1.75} />
        Restart Orbiter
      </button>
    </div>
  )
}

function MonthlyTokenUsage() {
  const tokenUsage = useSettingsStore((s) => s.tokenUsage)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const thisMonthUsage = tokenUsage.filter((e) => e.month === currentMonth)

  if (thisMonthUsage.length === 0) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={LABEL_STYLE}>Monthly Token Usage</div>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-tertiary)',
          }}
        >
          No token usage recorded this month.
        </div>
      </div>
    )
  }

  const totalTokens = thisMonthUsage.reduce((sum, e) => sum + e.tokens, 0)

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={LABEL_STYLE}>Monthly Token Usage — {currentMonth}</div>
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          marginBottom: 8,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens} total tokens
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 320 }}>
        {thisMonthUsage.map((entry) => (
          <div
            key={entry.agentId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>{entry.agentName}</span>
            <span
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {entry.tokens >= 1000 ? `${(entry.tokens / 1000).toFixed(1)}K` : entry.tokens}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DataSection() {
  const [storageUsed, setStorageUsed] = useState('Calculating...')

  useEffect(() => {
    // Estimate localStorage usage
    let total = 0
    for (const key of Object.keys(localStorage)) {
      total += localStorage.getItem(key)?.length ?? 0
    }
    const mb = (total * 2) / (1024 * 1024) // UTF-16 chars = 2 bytes each
    setStorageUsed(`${mb.toFixed(2)} MB`)
  }, [])

  const handleExport = useCallback(() => {
    const snapshot = serializeCanvas('export')
    const json = JSON.stringify(snapshot, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flow-canvas-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.nodes && Array.isArray(data.nodes)) {
          const { nodes, zoom, panOffset, groups } = data
          const restoredNodes = nodes.map((n: Record<string, unknown>, i: number) => ({
            ...n,
            type: n.type as string,
            metadata: {
              ...(n.metadata as Record<string, unknown>),
              materializing: true,
              materializeDelay: i * 50,
            },
          }))
          useCanvasStore.getState().restoreCanvas(restoredNodes, zoom ?? 1, panOffset ?? { x: 0, y: 0 }, groups)
          useUIStore.getState().addNotification({
            id: `import-${Date.now()}`,
            type: 'system',
            title: 'Canvas imported',
            message: `Loaded ${nodes.length} nodes.`,
            timestamp: Date.now(),
            autoDismiss: true,
          })
        }
      } catch {
        useUIStore.getState().addNotification({
          id: `import-err-${Date.now()}`,
          type: 'system',
          title: 'Import failed',
          message: 'Invalid canvas JSON file.',
          timestamp: Date.now(),
          status: 'error',
        })
      }
    }
    input.click()
  }, [])

  const handleClearCache = useCallback(() => {
    const confirmed = window.confirm('Clear all cached data? This will remove auto-saves and cached settings.')
    if (!confirmed) return
    localStorage.clear()
    useUIStore.getState().addNotification({
      id: `cache-${Date.now()}`,
      type: 'system',
      title: 'Cache cleared',
      message: 'All cached data has been removed. Refresh to apply defaults.',
      timestamp: Date.now(),
      autoDismiss: true,
    })
  }, [])

  return (
    <div>
      <div style={SECTION_TITLE}>Data</div>

      {/* Storage usage */}
      <div style={{ marginBottom: 20 }}>
        <div style={LABEL_STYLE}>Local Storage Usage</div>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}
        >
          {storageUsed}
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.08)',
            maxWidth: 320,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 3,
              background: 'var(--accent-blue)',
              width: '15%',
              transition: 'width 300ms',
            }}
          />
        </div>
      </div>

      {/* Monthly Token Usage */}
      <MonthlyTokenUsage />

      {/* Export / Import / Clear */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleExport}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          <Download size={14} strokeWidth={1.75} />
          Export Canvas
        </button>

        <button
          type="button"
          onClick={handleImport}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          <Upload size={14} strokeWidth={1.75} />
          Import Canvas
        </button>

        <button
          type="button"
          onClick={handleClearCache}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid rgba(255,69,58,0.3)',
            background: 'transparent',
            color: 'var(--accent-red)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          <Trash2 size={14} strokeWidth={1.75} />
          Clear Cache
        </button>
      </div>
    </div>
  )
}

export function AboutSection() {
  const setOnboardingComplete = useSettingsStore((s) => s.setOnboardingComplete)

  return (
    <div>
      <div style={SECTION_TITLE}>About</div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
          }}
        >
          Flow
        </div>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            marginTop: 4,
          }}
        >
          AI-Native Canvas Workspace
        </div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            marginTop: 8,
          }}
        >
          Version 0.1.0 (alpha)
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setOnboardingComplete(false)
          useUIStore.getState().setSettingsOpen(false)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 8,
          border: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)',
          color: 'var(--text-primary)',
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        <RotateCw size={14} strokeWidth={1.75} />
        Replay Onboarding Tour
      </button>
    </div>
  )
}

// --- Main SettingsPanel ---
