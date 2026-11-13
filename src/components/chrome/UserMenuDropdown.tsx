import { useRef, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { User, Palette, LogOut } from 'lucide-react'
import { GlassMenu } from '../glass'
import { useUIStore } from '../../stores'
import type { Theme } from '../../stores'

interface UserMenuDropdownProps {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

const THEME_CYCLE: Record<Theme, Theme> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
}

const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  } else {
    html.setAttribute('data-theme', theme)
  }
}

export function UserMenuDropdown({ open, onClose, anchorRef }: UserMenuDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const theme = useUIStore((s) => s.theme)

  // Position dropdown below the anchor, aligned right
  const posRef = useRef({ top: 0, right: 0 })

  useEffect(() => {
    if (open && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      posRef.current = {
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      }
    }
  }, [open, anchorRef])

  // Close on Esc
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Close on click-outside
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [open, onClose, anchorRef])

  const handleProfile = useCallback(() => {
    // Will open profile section in a future story
    onClose()
  }, [onClose])

  const handleAppearance = useCallback(() => {
    const current = useUIStore.getState().theme
    const next = THEME_CYCLE[current]
    useUIStore.getState().setTheme(next)
    applyTheme(next)
  }, [])

  const handleSignOut = useCallback(() => {
    // Will handle sign out in a future story
    onClose()
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: posRef.current.top,
            right: posRef.current.right,
            zIndex: 2000,
          }}
        >
          <GlassMenu open={open} style={{ width: 200 }}>
            {/* Profile */}
            <button
              type="button"
              onClick={handleProfile}
              className="glass-button"
              aria-label="Profile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                height: 36,
                padding: '0 10px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              <User size={18} strokeWidth={1.75} />
              Profile
            </button>

            {/* Appearance — cycles theme */}
            <button
              type="button"
              onClick={handleAppearance}
              className="glass-button"
              aria-label={`Appearance — ${THEME_LABELS[theme]}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                height: 36,
                padding: '0 10px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              <Palette size={18} strokeWidth={1.75} />
              <span>Appearance</span>
              <span
                style={{
                  marginLeft: 'auto',
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.06)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-tertiary)',
                }}
              >
                {THEME_LABELS[theme]}
              </span>
            </button>

            {/* Divider */}
            <div
              style={{
                height: 1,
                background: 'var(--glass-border)',
                opacity: 0.3,
                margin: '4px 0',
              }}
            />

            {/* Sign Out */}
            <button
              type="button"
              onClick={handleSignOut}
              className="glass-button"
              aria-label="Sign out"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                height: 36,
                padding: '0 10px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              <LogOut size={18} strokeWidth={1.75} />
              Sign Out
            </button>
          </GlassMenu>
        </div>
      )}
    </AnimatePresence>
  )
}
