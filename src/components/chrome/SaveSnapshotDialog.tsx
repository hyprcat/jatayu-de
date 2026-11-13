import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel, GlassInput, GlassButton } from '../glass'
import { Download, X } from 'lucide-react'
import { saveCanvasSnapshot } from '../../lib/canvasSave'
import { useUIStore } from '../../stores'

interface SaveSnapshotDialogProps {
  open: boolean
  onClose: () => void
}

export function SaveSnapshotDialog({ open, onClose }: SaveSnapshotDialogProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setSaving(false)
      // Small delay to ensure the input is rendered
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  // Close on Esc
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, onClose])

  const handleSave = useCallback(async () => {
    const snapshotName = name.trim() || `Snapshot ${new Date().toLocaleDateString()}`
    setSaving(true)
    const ok = await saveCanvasSnapshot(snapshotName)
    setSaving(false)

    if (ok) {
      useUIStore.getState().addNotification({
        id: `save-${Date.now()}`,
        type: 'system',
        title: 'Canvas Saved',
        message: `Snapshot "${snapshotName}" saved successfully.`,
        timestamp: Date.now(),
        autoDismiss: true,
      })
    } else {
      useUIStore.getState().addNotification({
        id: `save-err-${Date.now()}`,
        type: 'system',
        title: 'Save Failed',
        message: 'Could not save canvas snapshot.',
        status: 'error',
        timestamp: Date.now(),
      })
    }

    onClose()
  }, [name, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      }
    },
    [handleSave],
  )

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="save-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
          >
            <GlassPanel
              borderRadius={18}
              style={{
                width: 400,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-lg)',
                    fontWeight: 600,
                  }}
                >
                  <Download size={18} strokeWidth={1.75} />
                  Save Snapshot
                </div>
                <GlassButton aria-label="Close" onClick={onClose}>
                  <X size={16} strokeWidth={1.75} />
                </GlassButton>
              </div>

              {/* Name input */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  Snapshot name
                </label>
                <div
                  ref={(el) => {
                    if (el) inputRef.current = el.querySelector('input')
                  }}
                >
                  <GlassInput
                    placeholder="My Snapshot"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-label="Snapshot name"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }} onKeyDown={handleKeyDown}>
                <GlassButton aria-label="Cancel" onClick={onClose}>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
                      color: 'var(--text-secondary)',
                      padding: '0 8px',
                    }}
                  >
                    Cancel
                  </span>
                </GlassButton>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    height: 36,
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    padding: '0 16px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
