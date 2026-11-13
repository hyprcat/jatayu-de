import { useState, useCallback, useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import { GlassInput } from '../glass'
import { useUIStore, useSettingsStore, useCanvasStore } from '../../stores'
import type { Theme } from '../../stores'
import { FIELD_ROW, LABEL_STYLE, SECTION_TITLE, Toggle } from './settingsShared'

export function GeneralSection() {
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId)
  const canvases = useCanvasStore((s) => s.canvases)
  const renameCanvas = useCanvasStore((s) => s.renameCanvas)
  const workspaceDir = useSettingsStore((s) => s.workspaceDir)
  const setWorkspaceDir = useSettingsStore((s) => s.setWorkspaceDir)
  const autoSaveIntervalSec = useSettingsStore((s) => s.autoSaveIntervalSec)
  const setAutoSaveInterval = useSettingsStore((s) => s.setAutoSaveInterval)
  const startupCanvasId = useSettingsStore((s) => s.startupCanvasId)
  const setStartupCanvasId = useSettingsStore((s) => s.setStartupCanvasId)

  const activeCanvas = canvases.find((c) => c.id === activeCanvasId)
  const [canvasName, setCanvasName] = useState(activeCanvas?.name ?? '')

  useEffect(() => {
    setCanvasName(activeCanvas?.name ?? '')
  }, [activeCanvas?.name])

  const handleCanvasNameBlur = useCallback(() => {
    if (canvasName.trim() && canvasName !== activeCanvas?.name) {
      renameCanvas(activeCanvasId, canvasName.trim())
    }
  }, [canvasName, activeCanvas?.name, renameCanvas, activeCanvasId])

  const handlePickWorkspace = useCallback(async () => {
    if (!window.electronAPI) return
    const dir = (await window.electronAPI.invoke('dialog:openDirectory')) as string | null
    if (dir) setWorkspaceDir(dir)
  }, [setWorkspaceDir])

  return (
    <div>
      <div style={SECTION_TITLE}>General</div>

      {/* Canvas Name */}
      <div style={{ marginBottom: 20 }}>
        <div style={LABEL_STYLE}>Canvas Name</div>
        <GlassInput
          value={canvasName}
          onChange={(e) => setCanvasName(e.target.value)}
          aria-label="Canvas name"
          style={{ width: '100%', maxWidth: 320 }}
        />
        <button
          type="button"
          onClick={handleCanvasNameBlur}
          style={{
            marginLeft: 8,
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          Rename
        </button>
      </div>

      {/* Workspace Directory */}
      <div style={{ marginBottom: 20 }}>
        <div style={LABEL_STYLE}>Workspace Directory</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 6,
              flex: 1,
              maxWidth: 320,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {workspaceDir}
          </span>
          <button
            type="button"
            onClick={handlePickWorkspace}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            <FolderOpen size={14} strokeWidth={1.75} />
            Browse
          </button>
        </div>
      </div>

      {/* Auto-save Interval */}
      <div style={{ marginBottom: 20 }}>
        <div style={LABEL_STYLE}>Auto-save Interval: {autoSaveIntervalSec}s</div>
        <input
          type="range"
          min={10}
          max={300}
          step={10}
          value={autoSaveIntervalSec}
          onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
          aria-label="Auto-save interval"
          style={{ width: '100%', maxWidth: 320, accentColor: 'var(--accent-blue)' }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            maxWidth: 320,
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
          }}
        >
          <span>10s</span>
          <span>300s</span>
        </div>
      </div>

      {/* Startup Canvas */}
      <div style={{ marginBottom: 20 }}>
        <div style={LABEL_STYLE}>Startup Canvas</div>
        <select
          value={startupCanvasId}
          onChange={(e) => setStartupCanvasId(e.target.value)}
          aria-label="Startup canvas"
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            maxWidth: 320,
            width: '100%',
          }}
        >
          {canvases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function AppearanceSection() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const dotGridVisible = useSettingsStore((s) => s.dotGridVisible)
  const setDotGridVisible = useSettingsStore((s) => s.setDotGridVisible)
  const highContrastMode = useSettingsStore((s) => s.highContrastMode)
  const setHighContrastMode = useSettingsStore((s) => s.setHighContrastMode)

  const handleThemeChange = useCallback(
    (t: Theme) => {
      setTheme(t)
      const html = document.documentElement
      if (t === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        html.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      } else {
        html.setAttribute('data-theme', t)
      }
    },
    [setTheme],
  )

  return (
    <div>
      <div style={SECTION_TITLE}>Appearance</div>

      {/* Theme */}
      <div style={{ marginBottom: 20 }}>
        <div style={LABEL_STYLE}>Theme</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['dark', 'light', 'system'] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleThemeChange(t)}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: theme === t ? '1px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                background: theme === t ? 'rgba(10,132,255,0.15)' : 'var(--glass-bg)',
                color: theme === t ? 'var(--accent-blue)' : 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                transition: 'all 150ms',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Dot Grid */}
      <div style={FIELD_ROW}>
        <div>
          <div
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
            }}
          >
            Dot Grid
          </div>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            Show dot grid pattern on the canvas
          </div>
        </div>
        <Toggle checked={dotGridVisible} onChange={setDotGridVisible} />
      </div>

      {/* High Contrast */}
      <div style={FIELD_ROW}>
        <div>
          <div
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
            }}
          >
            High Contrast
          </div>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            Increase contrast for better visibility
          </div>
        </div>
        <Toggle checked={highContrastMode} onChange={setHighContrastMode} />
      </div>
    </div>
  )
}
