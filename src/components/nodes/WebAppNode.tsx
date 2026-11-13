import { useEffect, useRef, useCallback } from 'react'
import { useCanvasStore } from '../../stores'
import { createNode } from '../chrome/AddElementsDropdown'
import type { CanvasNode } from '../../stores'

interface WebAppNodeProps {
  node: CanvasNode
}

export function WebAppNode({ node }: WebAppNodeProps) {
  const initializedRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  const lockedUrl = node.metadata.lockedUrl as string | undefined

  // Compute screen bounds from world coords and send to main process
  const updateBounds = useCallback(() => {
    const { zoom, panOffset, nodes } = useCanvasStore.getState()
    const n = nodes.find((nd) => nd.id === node.id)
    if (!n) return

    const titleBarH = 33 // 32px title bar + 1px border-bottom
    const border = 1

    const screenX = n.position.x * zoom + panOffset.x + border * zoom
    const screenY = (n.position.y + titleBarH) * zoom + panOffset.y
    const screenW = (n.size.w - 2 * border) * zoom
    const screenH = (n.size.h - titleBarH - border) * zoom

    const vw = window.innerWidth
    const vh = window.innerHeight

    if (
      screenX + screenW < 0 ||
      screenY + screenH < 0 ||
      screenX > vw ||
      screenY > vh ||
      screenW <= 0 ||
      screenH <= 0
    ) {
      window.electronAPI.send('browser:setBounds', node.id, {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      })
    } else {
      window.electronAPI.send('browser:setBounds', node.id, {
        x: screenX,
        y: screenY,
        width: screenW,
        height: screenH,
      })
    }
  }, [node.id])

  // Throttled bounds update via rAF
  const scheduleBoundsUpdate = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      updateBounds()
    })
  }, [updateBounds])

  // Create WebContentsView and navigate to locked URL on mount
  useEffect(() => {
    if (initializedRef.current || !lockedUrl) return
    initializedRef.current = true

    const init = async () => {
      const api = window.electronAPI
      const result = (await api.invoke('webapp:create', node.id, lockedUrl)) as {
        ok: boolean
        cdpUrl?: string
      }
      if (result.cdpUrl) {
        const currentNode = useCanvasStore.getState().nodes.find((n) => n.id === node.id)
        useCanvasStore.getState().updateNode(node.id, {
          metadata: { ...currentNode?.metadata, cdpUrl: result.cdpUrl },
        })
      }
      requestAnimationFrame(updateBounds)
    }

    init()
  }, [node.id, lockedUrl, updateBounds])

  // Subscribe to canvas store changes to update bounds
  useEffect(() => {
    if (!initializedRef.current) return

    updateBounds()

    const unsub = useCanvasStore.subscribe(scheduleBoundsUpdate)
    window.addEventListener('resize', scheduleBoundsUpdate)

    return () => {
      unsub()
      window.removeEventListener('resize', scheduleBoundsUpdate)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [updateBounds, scheduleBoundsUpdate])

  // Bring WebContentsView to front when node z-index changes
  useEffect(() => {
    if (!initializedRef.current) return
    window.electronAPI.send('browser:focus', node.id)
  }, [node.zIndex, node.id])

  // Listen for external navigation events → create new browser node
  useEffect(() => {
    const api = window.electronAPI

    const externalNavListener = api.on(`webapp:external-nav:${node.id}`, (url: unknown) => {
      createNode('browser', { initialUrl: url as string })
    })

    return () => {
      if (externalNavListener) api.off(`webapp:external-nav:${node.id}`, externalNavListener)
    }
  }, [node.id])

  // Destroy WebContentsView on unmount
  useEffect(() => {
    return () => {
      if (initializedRef.current) {
        window.electronAPI.invoke('browser:destroy', node.id).catch(() => {})
      }
    }
  }, [node.id])

  // Content area background (native WebContentsView overlays this)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: 'var(--node-bg)',
      }}
    />
  )
}
