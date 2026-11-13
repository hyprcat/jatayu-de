interface GlassDividerProps {
  className?: string
  style?: React.CSSProperties
}

export function GlassDivider({ className = '', style }: GlassDividerProps) {
  return (
    <div
      className={className}
      role="separator"
      style={{
        width: 1,
        height: 24,
        background: 'var(--text-primary)',
        opacity: 0.3,
        margin: '0 8px',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
