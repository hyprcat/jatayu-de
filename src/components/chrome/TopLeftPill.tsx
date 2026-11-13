import { motion, AnimatePresence } from 'framer-motion'
import { EyeOff, Eye, BookOpen } from 'lucide-react'
import { GlassPill, GlassButton, Tooltip } from '../glass'
import { useUIStore } from '../../stores'

export function TopLeftPill() {
  const focusMode = useUIStore((s) => s.focusMode)
  const toggleFocusMode = useUIStore((s) => s.toggleFocusMode)

  const handleOpenDocs = () => {
    // Open docs URL in system browser via Electron shell
    if (window.electronAPI) {
      window.electronAPI.invoke('shell:openExternal', 'https://flow.dev/docs')
    }
  }

  return (
    <GlassPill style={{ height: 44, padding: '0 6px', gap: 2 }}>
      {/* Focus mode toggle */}
      <Tooltip label={focusMode ? 'Exit focus mode' : 'Focus mode'}>
        <GlassButton aria-label="Toggle focus mode" onClick={toggleFocusMode}>
          <AnimatePresence mode="wait" initial={false}>
            {focusMode ? (
              <motion.div
                key="eye"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Eye size={18} strokeWidth={1.75} />
              </motion.div>
            ) : (
              <motion.div
                key="eye-off"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <EyeOff size={18} strokeWidth={1.75} />
              </motion.div>
            )}
          </AnimatePresence>
        </GlassButton>
      </Tooltip>

      {/* Docs */}
      <Tooltip label="Documentation">
        <GlassButton aria-label="Open documentation" onClick={handleOpenDocs}>
          <BookOpen size={18} strokeWidth={1.75} />
        </GlassButton>
      </Tooltip>
    </GlassPill>
  )
}
