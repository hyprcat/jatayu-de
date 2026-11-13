import { useState, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { GlassInput } from '../glass'
import { useSettingsStore } from '../../stores'
import type { WebApp } from '../../stores'
import { LABEL_STYLE, SECTION_TITLE } from './settingsShared'

export function WebAppsSection() {
  const webApps = useSettingsStore((s) => s.webApps)
  const addWebApp = useSettingsStore((s) => s.addWebApp)
  const removeWebApp = useSettingsStore((s) => s.removeWebApp)
  const updateWebApp = useSettingsStore((s) => s.updateWebApp)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [form, setForm] = useState<WebApp>({
    name: '',
    url: '',
    iconUrl: '',
    category: '',
  })

  const startEdit = useCallback((app: WebApp) => {
    setEditingName(app.name)
    setForm({ ...app })
  }, [])

  const handleSave = useCallback(() => {
    if (!form.name.trim() || !form.url.trim()) return
    if (editingName) {
      updateWebApp(editingName, form)
    } else {
      addWebApp(form)
    }
    setEditingName(null)
    setForm({ name: '', url: '', iconUrl: '', category: '' })
  }, [editingName, form, updateWebApp, addWebApp])

  const handleAdd = useCallback(() => {
    setEditingName(null)
    setForm({ name: '', url: '', iconUrl: '', category: '' })
  }, [])

  return (
    <div>
      <div
        style={{
          ...SECTION_TITLE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        Web Apps
        <button
          type="button"
          onClick={handleAdd}
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
            fontWeight: 400,
          }}
        >
          <Plus size={14} strokeWidth={1.75} />
          Add Web App
        </button>
      </div>

      {/* Add/Edit form */}
      {(editingName !== null || (form.name === '' && form.url === '' && editingName === null)) && (
        <div
          style={{
            padding: '12px',
            borderRadius: 8,
            border: '1px solid var(--glass-border)',
            marginBottom: 12,
            background: 'rgba(255,255,255,0.02)',
            display: editingName !== null || form.name !== '' || form.url !== '' ? 'flex' : 'none',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={LABEL_STYLE}>Name</div>
              <GlassInput
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="App name"
                aria-label="Web app name"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={LABEL_STYLE}>Category</div>
              <GlassInput
                value={form.category ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. AI, Design"
                aria-label="Category"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div>
            <div style={LABEL_STYLE}>URL</div>
            <GlassInput
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://..."
              aria-label="Web app URL"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div style={LABEL_STYLE}>Icon URL (optional)</div>
            <GlassInput
              value={form.iconUrl ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, iconUrl: e.target.value }))}
              placeholder="https://..."
              aria-label="Icon URL"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--accent-blue)',
                color: '#fff',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {editingName ? 'Update' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingName(null)
                setForm({ name: '', url: '', iconUrl: '', category: '' })
              }}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: '1px solid var(--glass-border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Web app list */}
      {webApps.map((app) => (
        <div
          key={app.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderRadius: 8,
            marginBottom: 4,
          }}
          className="file-tree-row"
        >
          <div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
              }}
            >
              {app.name}
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
              }}
            >
              {app.url}
              {app.category && (
                <span
                  style={{
                    marginLeft: 8,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.06)',
                  }}
                >
                  {app.category}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => startEdit(app)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--glass-border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => removeWebApp(app.name)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid var(--glass-border)',
                background: 'transparent',
                color: 'var(--accent-red)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              <Trash2 size={12} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
