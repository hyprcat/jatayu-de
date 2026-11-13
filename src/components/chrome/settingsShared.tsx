import { Settings, Palette, Bot, Globe, Keyboard, Cpu, Database, Info } from 'lucide-react'

// --- Section types ---

export type Section = 'general' | 'appearance' | 'agents' | 'webapps' | 'keyboard' | 'orbiter' | 'data' | 'about'

export const SECTIONS: { id: Section; label: string; icon: typeof Settings }[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'webapps', label: 'Web Apps', icon: Globe },
  { id: 'keyboard', label: 'Keyboard', icon: Keyboard },
  { id: 'orbiter', label: 'Orbiter', icon: Cpu },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'about', label: 'About', icon: Info },
]

// --- Shared styles ---

export const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
}

export const FIELD_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
}

export const SECTION_TITLE: React.CSSProperties = {
  fontSize: 'var(--text-lg)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: 20,
  fontFamily: 'var(--font-display)',
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        background: checked ? 'var(--accent-blue)' : 'rgba(255,255,255,0.12)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 200ms',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          transition: 'left 200ms',
        }}
      />
    </button>
  )
}

// --- Section components ---
