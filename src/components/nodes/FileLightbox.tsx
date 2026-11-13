import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  FileText,
  FileImage,
  FileCode,
  FileAudio,
  FileVideo,
  File as FileIcon,
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileEdit,
} from 'lucide-react'
import { useCanvasStore, useUIStore } from '../../stores'
import type { CanvasNode } from '../../stores'
import { GlassPill } from '../glass'

// --- File type detection (shared with FileNode) ---

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])
const CODE_EXTS = new Set([
  'py',
  'js',
  'ts',
  'tsx',
  'jsx',
  'json',
  'yaml',
  'yml',
  'toml',
  'ini',
  'css',
  'scss',
  'html',
  'xml',
  'sql',
  'sh',
  'bash',
  'zsh',
  'fish',
  'c',
  'cpp',
  'h',
  'hpp',
  'java',
  'go',
  'rs',
  'rb',
  'php',
  'swift',
  'kt',
  'scala',
  'lua',
  'r',
  'pl',
  'ex',
  'exs',
  'clj',
  'hs',
  'vim',
  'el',
  'lisp',
  'dart',
  'zig',
  'nim',
  'v',
  'vue',
  'svelte',
  'txt',
  'log',
  'conf',
  'cfg',
  'env',
  'gitignore',
  'dockerfile',
  'makefile',
  'cmake',
])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'])
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'])

type FileCategory = 'image' | 'code' | 'markdown' | 'pdf' | 'audio' | 'video' | 'unknown'

function getFileCategory(filePath: string): FileCategory {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  if (ext === 'pdf') return 'pdf'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (CODE_EXTS.has(ext)) return 'code'
  return 'unknown'
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath.split('\\').pop() || filePath
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

// Simple markdown to HTML converter (same as FileNode)
function simpleMarkdownToHtml(md: string): string {
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(255,255,255,0.06);padding:2px 4px;border-radius:3px;font-family:var(--font-mono);font-size:var(--text-xs)">$1</code>',
  )
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const inner = match.slice(3, -3).replace(/^\w*\n/, '')
    return `<pre style="background:rgba(255,255,255,0.04);padding:12px;border-radius:6px;overflow-x:auto;font-family:var(--font-mono);font-size:var(--text-xs);line-height:1.5"><code>${inner}</code></pre>`
  })
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--glass-border);margin:12px 0">')
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" style="color:var(--accent-blue);text-decoration:none">$1</a>',
  )
  html = html.replace(/\n\n/g, '</p><p>')
  html = `<p>${html}</p>`
  html = html.replace(/<p><\/p>/g, '')
  return html
}

const CATEGORY_ICONS: Record<FileCategory, React.ReactNode> = {
  image: <FileImage size={14} strokeWidth={1.75} />,
  code: <FileCode size={14} strokeWidth={1.75} />,
  markdown: <FileText size={14} strokeWidth={1.75} />,
  pdf: <FileText size={14} strokeWidth={1.75} />,
  audio: <FileAudio size={14} strokeWidth={1.75} />,
  video: <FileVideo size={14} strokeWidth={1.75} />,
  unknown: <FileIcon size={14} strokeWidth={1.75} />,
}

// --- Fullscreen Renderers ---

function FullscreenImage({ filePath }: { filePath: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI
      .invoke('file:readBase64', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; data?: string }
        if (r.ok && r.data) {
          const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
          const mimeMap: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
            bmp: 'image/bmp',
            ico: 'image/x-icon',
          }
          setSrc(`data:${mimeMap[ext] || 'image/png'};base64,${r.data}`)
        }
      })
      .catch(() => {})
  }, [filePath])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((s) => Math.max(0.1, Math.min(10, s * delta)))
  }, [])

  if (!src) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-tertiary)',
        }}
      >
        <FileImage size={48} strokeWidth={1.2} />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={src}
        alt={getFileName(filePath)}
        draggable={false}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          transform: `scale(${scale})`,
          transition: 'transform 100ms ease',
        }}
      />
    </div>
  )
}

function FullscreenCode({ filePath }: { filePath: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [saved, setSaved] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.electronAPI
      .invoke('file:readText', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; content?: string }
        if (r.ok && r.content !== undefined) setContent(r.content)
      })
      .catch(() => {})
  }, [filePath])

  const handleSave = useCallback(() => {
    if (content === null) return
    window.electronAPI
      .invoke('file:writeText', filePath, content)
      .then((result: unknown) => {
        const r = result as { ok: boolean }
        if (r.ok) setSaved(true)
      })
      .catch(() => {})
  }, [filePath, content])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  if (content === null) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-tertiary)',
        }}
      >
        Loading…
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '4px 12px',
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <FileEdit size={12} strokeWidth={1.75} />
        {getFileName(filePath)}
        {!saved && <span style={{ color: 'var(--accent-orange)' }}>● modified</span>}
        {saved && <span style={{ opacity: 0.5 }}>saved</span>}
        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>⌘S to save</span>
      </div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          setSaved(false)
        }}
        spellCheck={false}
        style={{
          flex: 1,
          width: '100%',
          resize: 'none',
          background: 'var(--node-bg)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1.6,
          padding: 16,
          border: 'none',
          outline: 'none',
          tabSize: 2,
          whiteSpace: 'pre',
          overflowWrap: 'normal',
          overflow: 'auto',
        }}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  )
}

function FullscreenMarkdown({ filePath }: { filePath: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [saved, setSaved] = useState(true)
  const [splitView, setSplitView] = useState(true)

  useEffect(() => {
    window.electronAPI
      .invoke('file:readText', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; content?: string }
        if (r.ok && r.content !== undefined) setContent(r.content)
      })
      .catch(() => {})
  }, [filePath])

  const handleSave = useCallback(() => {
    if (content === null) return
    window.electronAPI
      .invoke('file:writeText', filePath, content)
      .then((result: unknown) => {
        const r = result as { ok: boolean }
        if (r.ok) setSaved(true)
      })
      .catch(() => {})
  }, [filePath, content])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  if (content === null) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-tertiary)',
        }}
      >
        Loading…
      </div>
    )
  }

  const html = simpleMarkdownToHtml(content)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '4px 12px',
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <FileText size={12} strokeWidth={1.75} />
        {getFileName(filePath)}
        {!saved && <span style={{ color: 'var(--accent-orange)' }}>● modified</span>}
        {saved && <span style={{ opacity: 0.5 }}>saved</span>}
        <button
          type="button"
          aria-label={splitView ? 'Single pane view' : 'Split view'}
          className="glass-button"
          onClick={() => setSplitView(!splitView)}
          style={{
            marginLeft: 'auto',
            width: 28,
            height: 24,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {splitView ? <FileEdit size={12} strokeWidth={1.75} /> : <Columns2 size={12} strokeWidth={1.75} />}
        </button>
        <span style={{ opacity: 0.5 }}>⌘S to save</span>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Rendered HTML */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 24,
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            lineHeight: 1.7,
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {/* Source editor */}
        {splitView && (
          <>
            <div style={{ width: 1, background: 'var(--glass-border)', flexShrink: 0 }} />
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setSaved(false)
              }}
              spellCheck={false}
              style={{
                flex: 1,
                resize: 'none',
                background: 'var(--node-bg)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                lineHeight: 1.6,
                padding: 16,
                border: 'none',
                outline: 'none',
                tabSize: 2,
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                overflow: 'auto',
              }}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </>
        )}
      </div>
    </div>
  )
}

function FullscreenPdf({ filePath }: { filePath: string }) {
  const [page, setPage] = useState(1)
  const totalPages = 1 // Placeholder — real pdf.js integration would provide actual page count

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--glass-border)',
          width: '100%',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          aria-label="Previous page"
          className="glass-button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          style={{ width: 28, height: 28, borderRadius: 6, opacity: page <= 1 ? 0.3 : 1 }}
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
        </button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          aria-label="Next page"
          className="glass-button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={{ width: 28, height: 28, borderRadius: 6, opacity: page >= totalPages ? 0.3 : 1 }}
        >
          <ChevronRight size={14} strokeWidth={1.75} />
        </button>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <FileText size={64} strokeWidth={1} style={{ color: 'var(--accent-red)', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {getFileName(filePath)}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              marginTop: 4,
            }}
          >
            PDF preview — full rendering requires pdf.js
          </div>
        </div>
      </div>
    </div>
  )
}

function FullscreenVideo({ filePath }: { filePath: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    window.electronAPI
      .invoke('file:readBase64', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; data?: string }
        if (r.ok && r.data) {
          const ext = filePath.split('.').pop()?.toLowerCase() || 'mp4'
          const mimeMap: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }
          setSrc(`data:${mimeMap[ext] || 'video/mp4'};base64,${r.data}`)
        }
      })
      .catch(() => {})
  }, [filePath])

  if (!src) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-tertiary)',
        }}
      >
        <FileVideo size={48} strokeWidth={1.2} />
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
      }}
    >
      <video ref={videoRef} src={src} controls style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  )
}

function FullscreenAudio({ filePath }: { filePath: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI
      .invoke('file:readBase64', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; data?: string }
        if (r.ok && r.data) {
          const ext = filePath.split('.').pop()?.toLowerCase() || 'mp3'
          const mimeMap: Record<string, string> = {
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            ogg: 'audio/ogg',
            flac: 'audio/flac',
            aac: 'audio/aac',
            m4a: 'audio/mp4',
          }
          setSrc(`data:${mimeMap[ext] || 'audio/mpeg'};base64,${r.data}`)
        }
      })
      .catch(() => {})
  }, [filePath])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 16,
      }}
    >
      <FileAudio size={48} strokeWidth={1.2} style={{ color: 'var(--text-tertiary)' }} />
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        {getFileName(filePath)}
      </span>
      {src ? (
        <audio src={src} controls style={{ width: 320 }} />
      ) : (
        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>Loading audio…</span>
      )}
    </div>
  )
}

function FullscreenUnknown({ filePath, fileSize }: { filePath: string; fileSize: number | null }) {
  const ext = filePath.split('.').pop()?.toUpperCase() || '?'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
        color: 'var(--text-tertiary)',
      }}
    >
      <FileIcon size={64} strokeWidth={1} />
      <span
        style={{
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          background: 'rgba(255,255,255,0.06)',
          padding: '2px 8px',
          borderRadius: 4,
        }}
      >
        .{ext}
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        {getFileName(filePath)}
      </span>
      {fileSize !== null && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          {formatFileSize(fileSize)}
        </span>
      )}
    </div>
  )
}

// --- Main Lightbox Component ---

function LightboxContent({ node }: { node: CanvasNode }) {
  const filePath = node.metadata.filePath as string | undefined
  const [fileSize, setFileSize] = useState<number | null>(null)

  useEffect(() => {
    if (!filePath) return
    window.electronAPI
      .invoke('file:stat', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; size?: number }
        if (r.ok && r.size !== undefined) setFileSize(r.size)
      })
      .catch(() => {})
  }, [filePath])

  if (!filePath) return null

  const category = getFileCategory(filePath)

  switch (category) {
    case 'image':
      return <FullscreenImage filePath={filePath} />
    case 'code':
      return <FullscreenCode filePath={filePath} />
    case 'markdown':
      return <FullscreenMarkdown filePath={filePath} />
    case 'pdf':
      return <FullscreenPdf filePath={filePath} />
    case 'audio':
      return <FullscreenAudio filePath={filePath} />
    case 'video':
      return <FullscreenVideo filePath={filePath} />
    default:
      return <FullscreenUnknown filePath={filePath} fileSize={fileSize} />
  }
}

function LightboxInfoBar({ node, onClose }: { node: CanvasNode; onClose: () => void }) {
  const filePath = node.metadata.filePath as string | undefined
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [modifiedMs, setModifiedMs] = useState<number | null>(null)

  useEffect(() => {
    if (!filePath) return
    window.electronAPI
      .invoke('file:stat', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; size?: number; modifiedMs?: number }
        if (r.ok) {
          if (r.size !== undefined) setFileSize(r.size)
          if (r.modifiedMs !== undefined) setModifiedMs(r.modifiedMs)
        }
      })
      .catch(() => {})
  }, [filePath])

  const category = filePath ? getFileCategory(filePath) : 'unknown'

  return (
    <GlassPill
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 16px',
        gap: 10,
        fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-body)',
        color: 'var(--text-secondary)',
        zIndex: 10,
      }}
    >
      {CATEGORY_ICONS[category]}
      <span style={{ color: 'var(--text-primary)' }}>{filePath ? getFileName(filePath) : 'Unknown'}</span>
      {fileSize !== null && <span style={{ opacity: 0.6 }}>{formatFileSize(fileSize)}</span>}
      {modifiedMs !== null && <span style={{ opacity: 0.6 }}>Modified {timeAgo(modifiedMs)}</span>}
      <button
        type="button"
        aria-label="Close lightbox"
        className="glass-button"
        onClick={onClose}
        style={{ width: 24, height: 24, borderRadius: 6, marginLeft: 4 }}
      >
        <X size={14} strokeWidth={1.75} />
      </button>
    </GlassPill>
  )
}

export function FileLightbox() {
  const lightboxNodeId = useUIStore((s) => s.lightboxNodeId)
  const nodes = useCanvasStore((s) => s.nodes)
  const zoom = useCanvasStore((s) => s.zoom)
  const panOffset = useCanvasStore((s) => s.panOffset)

  const node = lightboxNodeId ? nodes.find((n) => n.id === lightboxNodeId) : null

  const close = useCallback(() => {
    useUIStore.getState().setLightboxNodeId(null)
  }, [])

  // Esc to close
  useEffect(() => {
    if (!node) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [node, close])

  // Compute canvas-to-screen position for animation origin
  const getNodeScreenRect = useCallback(() => {
    if (!node) return { x: 0, y: 0, width: 0, height: 0 }
    return {
      x: node.position.x * zoom + panOffset.x,
      y: node.position.y * zoom + panOffset.y,
      width: node.size.w * zoom,
      height: node.size.h * zoom,
    }
  }, [node, zoom, panOffset])

  const MARGIN = 48

  return createPortal(
    <AnimatePresence>
      {node && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Dark overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={close}
          />

          {/* Content area — animates from node position to full viewport */}
          <motion.div
            initial={(() => {
              const r = getNodeScreenRect()
              return {
                x: r.x - (MARGIN + (window.innerWidth - 2 * MARGIN) / 2 - r.width / 2),
                y: r.y - (MARGIN + (window.innerHeight - 2 * MARGIN) / 2 - r.height / 2),
                width: r.width,
                height: r.height,
                opacity: 0.8,
              }
            })()}
            animate={{
              x: 0,
              y: 0,
              width: window.innerWidth - 2 * MARGIN,
              height: window.innerHeight - 2 * MARGIN,
              opacity: 1,
            }}
            exit={(() => {
              const r = getNodeScreenRect()
              return {
                x: r.x - (MARGIN + (window.innerWidth - 2 * MARGIN) / 2 - r.width / 2),
                y: r.y - (MARGIN + (window.innerHeight - 2 * MARGIN) / 2 - r.height / 2),
                width: r.width,
                height: r.height,
                opacity: 0,
              }
            })()}
            transition={{ type: 'spring', stiffness: 300, damping: 30, duration: 0.35 }}
            style={{
              position: 'relative',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'var(--node-bg)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              zIndex: 1,
            }}
          >
            <LightboxContent node={node} />
          </motion.div>

          {/* Bottom info bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2 }}
          >
            <LightboxInfoBar node={node} onClose={close} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
