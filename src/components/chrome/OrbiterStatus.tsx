import { useState, useEffect, useCallback } from 'react'
import { RotateCw } from 'lucide-react'
import { GlassButton } from '../glass'
import { useSettingsStore } from '../../stores'

type OrbiterState = 'running' | 'stopped' | 'error'

export function OrbiterStatus() {
  const [status, setStatus] = useState<OrbiterState>('stopped')
  const [error, setError] = useState('')
  const orbiterPath = useSettingsStore((s) => s.orbiterPath)

  // Poll initial status on mount
  useEffect(() => {
    if (!window.orbiter) return
    window.orbiter.status().then((res) => {
      setStatus(res.status as OrbiterState)
      setError(res.error || '')
    })
  }, [])

  // Listen for status updates from main process
  useEffect(() => {
    if (!window.orbiter) return
    const handle = window.orbiter.onStatus((data: unknown) => {
      const d = data as { status: string; error?: string }
      setStatus(d.status as OrbiterState)
      setError(d.error || '')
    })
    return () => {
      window.orbiter.offStatus(handle)
    }
  }, [])

  const handleRestart = useCallback(() => {
    if (!window.orbiter) return
    window.orbiter.restart(orbiterPath).then((res) => {
      setStatus(res.status as OrbiterState)
      setError(res.error || '')
    })
  }, [orbiterPath])

  const dotColor =
    status === 'running' ? 'var(--accent-green)' : status === 'error' ? 'var(--accent-red)' : 'var(--text-tertiary)'

  const statusLabel = status === 'running' ? 'Running' : status === 'error' ? 'Error' : 'Stopped'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
          }}
        >
          Orbiter: {statusLabel}
        </span>
      </div>

      {error && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--accent-red)',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {error}
        </span>
      )}

      <GlassButton onClick={handleRestart} aria-label="Restart Orbiter">
        <RotateCw size={16} strokeWidth={1.75} />
      </GlassButton>
    </div>
  )
}
