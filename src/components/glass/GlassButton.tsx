import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface GlassButtonProps {
  children?: ReactNode
  onClick?: () => void
  'aria-label': string
  className?: string
  style?: React.CSSProperties
}

export function GlassButton({ children, onClick, 'aria-label': ariaLabel, className = '', style }: GlassButtonProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      className={`glass-button ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
      whileTap={reducedMotion ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', duration: 0.2 }}
      style={style}
    >
      {children}
    </motion.button>
  )
}
