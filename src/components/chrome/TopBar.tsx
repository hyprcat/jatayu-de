import { useState, useRef, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Plus, FolderOpen, Bot, Download, RotateCcw, SlidersHorizontal, Bell } from 'lucide-react'
import { GlassPill, GlassButton, GlassDivider, Tooltip } from '../glass'
import { useUIStore, useHistoryStore } from '../../stores'
import { AddElementsDropdown } from './AddElementsDropdown'
import { AgentsMenuDropdown } from './AgentsMenuDropdown'
import { UserMenuDropdown } from './UserMenuDropdown'
import { SaveSnapshotDialog } from './SaveSnapshotDialog'
import { RestoreMenu } from './RestoreMenu'

export function TopBar() {
  const unreadCount = useUIStore((s) => s.unreadCount)
  const saveDialogOpen = useUIStore((s) => s.saveDialogOpen)
  const historyCount = useHistoryStore((s) => s.undoStack.length)
  const reducedMotion = useReducedMotion()
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [agentsMenuOpen, setAgentsMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [restoreMenuOpen, setRestoreMenuOpen] = useState(false)
  const plusRef = useRef<HTMLDivElement>(null)
  const botRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<HTMLDivElement>(null)

  const toggleAddMenu = useCallback(() => {
    setAddMenuOpen((prev) => !prev)
  }, [])

  const closeAddMenu = useCallback(() => {
    setAddMenuOpen(false)
  }, [])

  const toggleAgentsMenu = useCallback(() => {
    setAgentsMenuOpen((prev) => !prev)
  }, [])

  const closeAgentsMenu = useCallback(() => {
    setAgentsMenuOpen(false)
  }, [])

  const toggleUserMenu = useCallback(() => {
    setUserMenuOpen((prev) => !prev)
  }, [])

  const closeUserMenu = useCallback(() => {
    setUserMenuOpen(false)
  }, [])

  return (
    <>
      <GlassPill style={{ height: 44, padding: '0 6px', gap: 2 }}>
        {/* Plus — Add */}
        <Tooltip label="Add element">
          <motion.div
            ref={plusRef}
            whileHover={reducedMotion ? undefined : { rotate: 90 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <GlassButton aria-label="Add element" onClick={toggleAddMenu}>
              <Plus size={18} strokeWidth={1.75} />
            </GlassButton>
          </motion.div>
        </Tooltip>

        {/* FolderOpen — Explorer */}
        <Tooltip label="File explorer">
          <GlassButton
            aria-label="File explorer"
            onClick={() => useUIStore.getState().setFileExplorerOpen(!useUIStore.getState().fileExplorerOpen)}
          >
            <FolderOpen size={18} strokeWidth={1.75} />
          </GlassButton>
        </Tooltip>

        {/* Bot — Agents */}
        <Tooltip label="Agents">
          <motion.div
            ref={botRef}
            whileHover={reducedMotion ? undefined : { y: -3 }}
            transition={{ type: 'spring', duration: 0.25 }}
          >
            <GlassButton aria-label="Agents" onClick={toggleAgentsMenu}>
              <Bot size={18} strokeWidth={1.75} />
            </GlassButton>
          </motion.div>
        </Tooltip>

        <GlassDivider />

        {/* Download — Save */}
        <Tooltip label="Save canvas (⌘S)">
          <GlassButton aria-label="Save canvas" onClick={() => useUIStore.getState().setSaveDialogOpen(true)}>
            <Download size={18} strokeWidth={1.75} />
          </GlassButton>
        </Tooltip>

        {/* RotateCcw — Restore */}
        <Tooltip
          label={historyCount > 0 ? `Restore snapshot · ${historyCount} actions in history` : 'Restore snapshot'}
        >
          <div ref={restoreRef}>
            <GlassButton aria-label="Restore snapshot" onClick={() => setRestoreMenuOpen((prev) => !prev)}>
              <RotateCcw size={18} strokeWidth={1.75} />
            </GlassButton>
          </div>
        </Tooltip>

        {/* SlidersHorizontal — Settings */}
        <Tooltip label="Settings">
          <GlassButton aria-label="Settings" onClick={() => useUIStore.getState().setSettingsOpen(true)}>
            <SlidersHorizontal size={18} strokeWidth={1.75} />
          </GlassButton>
        </Tooltip>

        {/* Bell — Notifications */}
        <Tooltip label="Notifications">
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <GlassButton aria-label="Notifications">
              <Bell size={18} strokeWidth={1.75} />
            </GlassButton>
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent-red)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </Tooltip>

        {/* User Avatar */}
        <Tooltip label="User menu">
          <button
            ref={avatarRef}
            type="button"
            aria-label="User menu"
            onClick={toggleUserMenu}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginLeft: 2,
              flexShrink: 0,
            }}
          >
            U
          </button>
        </Tooltip>
      </GlassPill>

      {/* Add Elements Dropdown */}
      <AddElementsDropdown open={addMenuOpen} onClose={closeAddMenu} anchorRef={plusRef} />

      {/* Agents Menu Dropdown */}
      <AgentsMenuDropdown open={agentsMenuOpen} onClose={closeAgentsMenu} anchorRef={botRef} />

      {/* User Menu Dropdown */}
      <UserMenuDropdown open={userMenuOpen} onClose={closeUserMenu} anchorRef={avatarRef} />

      {/* Save Snapshot Dialog */}
      <SaveSnapshotDialog open={saveDialogOpen} onClose={() => useUIStore.getState().setSaveDialogOpen(false)} />

      {/* Restore Menu */}
      <RestoreMenu open={restoreMenuOpen} onClose={() => setRestoreMenuOpen(false)} anchorRef={restoreRef} />
    </>
  )
}
