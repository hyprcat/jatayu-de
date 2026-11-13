import type { ReactNode } from 'react'

interface GlassPillProps {
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function GlassPill({ children, className = '', style }: GlassPillProps) {
  return (
    <div
      className={`glass-pill ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
