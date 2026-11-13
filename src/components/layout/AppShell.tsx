import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useUIStore } from '../../stores'

interface AppShellProps {
  /** Content rendered on the canvas layer (z-index 0) */
  canvas?: ReactNode
  /** Top bar zone — centered horizontally, 16px from top */
  topBar?: ReactNode
  /** Top-left pill zone — 16px from top-left corner */
  topLeft?: ReactNode
  /** Bottom-left pill zone — 16px from bottom-left corner */
  bottomLeft?: ReactNode
  /** Bottom-right notification zone — 16px from bottom-right corner */
  bottomRight?: ReactNode
  /** Left panel zone — full height, default hidden */
  leftPanel?: ReactNode
  /** Right panel zone — full height, default hidden */
  rightPanel?: ReactNode
}

export function AppShell({ canvas, topBar, topLeft, bottomLeft, bottomRight, leftPanel, rightPanel }: AppShellProps) {
  const focusMode = useUIStore((s) => s.focusMode)

  return (
    <div className="app-shell">
      {/* Canvas layer — z-index 0 */}
      <div className="app-shell__canvas">{canvas}</div>

      {/* Left panel zone — z-index 500 */}
      <div className="app-shell__panel-left">{leftPanel}</div>

      {/* Right panel zone — z-index 500 */}
      <div className="app-shell__panel-right">{rightPanel}</div>

      {/* Top bar zone — z-index 1000, animates out during focus mode */}
      <motion.div
        className="app-shell__top-bar"
        animate={{ y: focusMode ? '-100%' : 0 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
      >
        {topBar}
      </motion.div>

      {/* Top-left pill zone — z-index 1000 */}
      <div className="app-shell__top-left">{topLeft}</div>

      {/* Bottom-left pill zone — z-index 1000 */}
      <div className="app-shell__bottom-left">{bottomLeft}</div>

      {/* Bottom-right notification zone — z-index 1000 */}
      <div className="app-shell__bottom-right">{bottomRight}</div>
    </div>
  )
}
