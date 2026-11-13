interface GlassInputProps {
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
}

export function GlassInput({
  placeholder,
  value,
  onChange,
  className = '',
  style,
  'aria-label': ariaLabel,
}: GlassInputProps) {
  return (
    <input
      type="text"
      className={`glass-input ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      style={style}
    />
  )
}
