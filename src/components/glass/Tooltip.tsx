import { type ReactElement, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TooltipProps {
  label: string
  delay?: number
  children: ReactElement
}

export function Tooltip({ label, delay = 800, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTooltip = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay)
  }, [delay])

  const hideTooltip = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setVisible(false)
  }, [])

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }} onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            className="glass"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 8,
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 2000,
            }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
