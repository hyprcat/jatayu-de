import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X, Settings } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useUIStore } from '../../stores'
import { AgentsSection } from './SettingsAgents'
import { AppearanceSection, GeneralSection } from './SettingsGeneral'
import { AboutSection, DataSection, KeyboardSection, OrbiterSection } from './SettingsSystem'
import { WebAppsSection } from './SettingsWebApps'
import { SECTIONS, type Section } from './settingsShared'

export function SettingsPanel() {
  const open = useUIStore((s) => s.settingsOpen)
  const reducedMotion = useReducedMotion()
  const [activeSection, setActiveSection] = useState<Section>('general')
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  const close = useCallback(() => {
    useUIStore.getState().setSettingsOpen(false)
  }, [])

  // Esc closes
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [open, close])

  const sectionContent = useMemo(() => {
    switch (activeSection) {
      case 'general':
        return <GeneralSection />
      case 'appearance':
        return <AppearanceSection />
      case 'agents':
        return <AgentsSection />
      case 'webapps':
        return <WebAppsSection />
      case 'keyboard':
        return <KeyboardSection />
      case 'orbiter':
        return <OrbiterSection />
      case 'data':
        return <DataSection />
      case 'about':
        return <AboutSection />
      default:
        return null
    }
  }, [activeSection])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={reducedMotion ? { opacity: 0 } : { y: '100%' }}
          animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          role="dialog"
          aria-label="Settings"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'var(--bg-canvas)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'var(--font-body)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              borderBottom: '1px solid var(--glass-border)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Settings size={20} strokeWidth={1.75} />
              <span
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Settings
              </span>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close settings"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid var(--glass-border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>

          {/* Body: sidebar + content */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Sidebar */}
            <nav
              style={{
                width: 200,
                borderRight: '1px solid var(--glass-border)',
                padding: '16px 8px',
                flexShrink: 0,
                overflowY: 'auto',
              }}
            >
              {SECTIONS.map((sec) => {
                const Icon = sec.icon
                const isActive = activeSection === sec.id
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSection(sec.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                      transition: 'background 150ms, color 150ms',
                      marginBottom: 2,
                      textAlign: 'left',
                    }}
                  >
                    <Icon size={16} strokeWidth={1.75} />
                    {sec.label}
                  </button>
                )
              })}
            </nav>

            {/* Content area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 32px',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={reducedMotion ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {sectionContent}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
