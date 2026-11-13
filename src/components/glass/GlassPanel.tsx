import type { ReactNode } from 'react'

interface GlassPanelProps {
  children?: ReactNode
  className?: string
  borderRadius?: number | string
  style?: React.CSSProperties
}

export function GlassPanel({ children, className = '', borderRadius, style }: GlassPanelProps) {
  return (
    <div
      className={`glass ${className}`}
      style={{
        ...(borderRadius != null ? { borderRadius } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
