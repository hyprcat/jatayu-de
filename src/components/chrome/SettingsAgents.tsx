import { useState, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { GlassInput } from '../glass'
import { useAgentStore } from '../../stores'
import type { Agent } from '../../stores'
import { LABEL_STYLE, SECTION_TITLE } from './settingsShared'

export function AgentsSection() {
  const agents = useAgentStore((s) => s.agents)
  const addAgent = useAgentStore((s) => s.addAgent)
  const removeAgent = useAgentStore((s) => s.removeAgent)
  const updateAgent = useAgentStore((s) => s.updateAgent)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    color: '#0A84FF',
    modelProvider: '',
    modelId: '',
    systemPrompt: '',
  })

  const startEdit = useCallback((agent: Agent) => {
    setEditingId(agent.id)
    setForm({
      name: agent.name,
      color: agent.color,
      modelProvider: (agent as Agent & { modelProvider?: string }).modelProvider ?? '',
      modelId: (agent as Agent & { modelId?: string }).modelId ?? '',
      systemPrompt: (agent as Agent & { systemPrompt?: string }).systemPrompt ?? '',
    })
  }, [])

  const handleSave = useCallback(() => {
    if (!editingId || !form.name.trim()) return
    updateAgent(editingId, {
      name: form.name.trim(),
      color: form.color,
    } as Partial<Agent>)
    setEditingId(null)
  }, [editingId, form, updateAgent])

  const handleCreate = useCallback(() => {
    const id = `agent-${Date.now()}`
    addAgent({
      id,
      name: 'New Agent',
      color: '#0A84FF',
      status: 'idle',
      currentTask: '',
    })
    startEdit({
      id,
      name: 'New Agent',
      color: '#0A84FF',
      status: 'idle',
      currentTask: '',
    })
  }, [addAgent, startEdit])

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
        Agents
        <button
          type="button"
          onClick={handleCreate}
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
          Add Agent
        </button>
      </div>

      {/* Agent list */}
      {agents.length === 0 && (
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-tertiary)',
            padding: '20px 0',
          }}
        >
          No agents configured. Click "Add Agent" to create one.
        </div>
      )}

      {agents.map((agent) => (
        <div
          key={agent.id}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--glass-border)',
            marginBottom: 8,
            background: editingId === agent.id ? 'rgba(255,255,255,0.04)' : 'transparent',
          }}
        >
          {editingId === agent.id ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Name */}
              <div>
                <div style={LABEL_STYLE}>Name</div>
                <GlassInput
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  aria-label="Agent name"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Color */}
              <div>
                <div style={LABEL_STYLE}>Color</div>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  style={{
                    width: 40,
                    height: 28,
                    border: '1px solid var(--glass-border)',
                    borderRadius: 6,
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Model Provider */}
              <div>
                <div style={LABEL_STYLE}>Model Provider</div>
                <select
                  value={form.modelProvider}
                  onChange={(e) => setForm((f) => ({ ...f, modelProvider: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <option value="">Select provider...</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>

              {/* Model ID */}
              <div>
                <div style={LABEL_STYLE}>Model ID</div>
                <GlassInput
                  value={form.modelId}
                  onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
                  placeholder="e.g. gpt-4, claude-3-opus"
                  aria-label="Model ID"
                  style={{ width: '100%' }}
                />
              </div>

              {/* System Prompt */}
              <div>
                <div style={LABEL_STYLE}>System Prompt</div>
                <textarea
                  className="glass-input"
                  value={form.systemPrompt}
                  onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                  rows={3}
                  placeholder="System instructions for this agent..."
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                  }}
                />
              </div>

              {/* API Key placeholder */}
              {form.modelProvider && form.modelProvider !== 'ollama' && (
                <div>
                  <div style={LABEL_STYLE}>API Key ({form.modelProvider})</div>
                  <GlassInput placeholder="sk-..." aria-label="API key" style={{ width: '100%' }} />
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-tertiary)',
                      marginTop: 4,
                    }}
                  >
                    Stored locally. Never sent to Flow servers.
                  </div>
                </div>
              )}

              {/* Save / Cancel */}
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
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
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
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: agent.color,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {agent.name}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {agent.status}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => startEdit(agent)}
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
                  onClick={() => removeAgent(agent.id)}
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
          )}
        </div>
      ))}
    </div>
  )
}
