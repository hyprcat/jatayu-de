import { type ReactNode, Children } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface GlassMenuProps {
  open: boolean
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function GlassMenu({ open, children, className = '', style }: GlassMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`glass ${className}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ type: 'spring', duration: 0.25 }}
          style={{
            borderRadius: 14,
            padding: 6,
            ...style,
          }}
        >
          {Children.map(children, (child, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, type: 'spring', duration: 0.25 }}
            >
              {child}
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
