import { useEffect, useState, useRef, useCallback } from 'react'
import { FileText, FileImage, FileCode, FileAudio, FileVideo, File as FileIcon, Play, Pause } from 'lucide-react'
import type { CanvasNode } from '../../stores'
import { useUIStore } from '../../stores'

// --- File type detection ---

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

// --- Renderers ---

function ImageRenderer({ filePath }: { filePath: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    window.electronAPI
      .invoke('file:readBase64', filePath)
      .then((result: unknown) => {
        if (cancelled) return
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
          const mime = mimeMap[ext] || 'image/png'
          setSrc(`data:${mime};base64,${r.data}`)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [filePath])

  if (!src) {
    return (
      <div style={CENTER_STYLE}>
        <FileImage size={32} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
        <span style={LABEL_STYLE}>Loading image…</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={getFileName(filePath)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block',
      }}
      draggable={false}
    />
  )
}

function CodeRenderer({ filePath }: { filePath: string }) {
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI
      .invoke('file:readText', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; content?: string }
        if (r.ok && r.content !== undefined) {
          setContent(r.content)
        }
      })
      .catch(() => {})
  }, [filePath])

  if (content === null) {
    return (
      <div style={CENTER_STYLE}>
        <FileCode size={32} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
        <span style={LABEL_STYLE}>Loading…</span>
      </div>
    )
  }

  return (
    <pre
      style={{
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 12,
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-primary)',
        background: 'var(--node-bg)',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        tabSize: 2,
      }}
    >
      {content}
    </pre>
  )
}

function MarkdownRenderer({ filePath }: { filePath: string }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI
      .invoke('file:readText', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; content?: string }
        if (r.ok && r.content !== undefined) {
          // Simple markdown to HTML conversion
          setHtml(simpleMarkdownToHtml(r.content))
        }
      })
      .catch(() => {})
  }, [filePath])

  if (html === null) {
    return (
      <div style={CENTER_STYLE}>
        <FileText size={32} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
        <span style={LABEL_STYLE}>Loading…</span>
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        padding: 16,
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-primary)',
        lineHeight: 1.6,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function PdfRenderer({ filePath }: { filePath: string }) {
  return (
    <div style={CENTER_STYLE}>
      <FileText size={48} strokeWidth={1.2} style={{ color: 'var(--accent-red)' }} />
      <span style={{ ...LABEL_STYLE, fontSize: 'var(--text-sm)' }}>{getFileName(filePath)}</span>
      <span style={LABEL_STYLE}>PDF preview</span>
    </div>
  )
}

function AudioRenderer({ filePath }: { filePath: string }) {
  const [playing, setPlaying] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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
          const mime = mimeMap[ext] || 'audio/mpeg'
          setSrc(`data:${mime};base64,${r.data}`)
        }
      })
      .catch(() => {})
  }, [filePath])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play()
    }
    setPlaying(!playing)
  }, [playing])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        background: 'var(--node-bg)',
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          togglePlay()
        }}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={playing ? 'Pause audio' : 'Play audio'}
        className="glass-button"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {playing ? (
          <Pause size={16} strokeWidth={1.75} />
        ) : (
          <Play size={16} strokeWidth={1.75} style={{ marginLeft: 2 }} />
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-body)',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <FileAudio size={14} strokeWidth={1.75} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {getFileName(filePath)}
        </div>
        {/* Waveform placeholder bar */}
        <div
          style={{
            marginTop: 6,
            height: 24,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            padding: '0 4px',
          }}
        >
          {Array.from({ length: 40 }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${20 + Math.sin(i * 0.5) * 40 + Math.random() * 30}%`,
                background: 'var(--text-tertiary)',
                borderRadius: 1,
                opacity: 0.4,
              }}
            />
          ))}
        </div>
      </div>

      {src && <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} preload="metadata" />}
    </div>
  )
}

function VideoRenderer({ filePath }: { filePath: string }) {
  const [playing, setPlaying] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    window.electronAPI
      .invoke('file:readBase64', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; data?: string }
        if (r.ok && r.data) {
          const ext = filePath.split('.').pop()?.toLowerCase() || 'mp4'
          const mimeMap: Record<string, string> = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            mov: 'video/quicktime',
          }
          const mime = mimeMap[ext] || 'video/mp4'
          setSrc(`data:${mime};base64,${r.data}`)
        }
      })
      .catch(() => {})
  }, [filePath])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (playing) {
      video.pause()
    } else {
      video.play()
    }
    setPlaying(!playing)
  }, [playing])

  if (!src) {
    return (
      <div style={CENTER_STYLE}>
        <FileVideo size={48} strokeWidth={1.2} style={{ color: 'var(--text-tertiary)' }} />
        <span style={LABEL_STYLE}>{getFileName(filePath)}</span>
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#000',
        cursor: 'pointer',
      }}
      onClick={(e) => {
        e.stopPropagation()
        togglePlay()
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <video
        ref={videoRef}
        src={src}
        onEnded={() => setPlaying(false)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
      {!playing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Play size={24} strokeWidth={1.75} style={{ marginLeft: 3, color: '#fff' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function UnknownRenderer({ filePath, fileSize }: { filePath: string; fileSize: number | null }) {
  const ext = filePath.split('.').pop()?.toUpperCase() || '?'

  return (
    <div style={CENTER_STYLE}>
      <FileIcon size={48} strokeWidth={1.2} style={{ color: 'var(--text-tertiary)' }} />
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
      <span
        style={{ ...LABEL_STYLE, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {getFileName(filePath)}
      </span>
      {fileSize !== null && (
        <span style={{ ...LABEL_STYLE, fontSize: 'var(--text-xs)' }}>{formatFileSize(fileSize)}</span>
      )}
    </div>
  )
}

// --- Shared styles ---

const CENTER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  width: '100%',
  color: 'var(--text-tertiary)',
  flexDirection: 'column',
  gap: 8,
  userSelect: 'none',
  background: 'var(--node-bg)',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontFamily: 'var(--font-body)',
  color: 'var(--text-secondary)',
}

// --- Simple markdown → HTML converter (no external dependency) ---

function simpleMarkdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Headers
  html = html.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(255,255,255,0.06);padding:2px 4px;border-radius:3px;font-family:var(--font-mono);font-size:var(--text-xs)">$1</code>',
  )

  // Code blocks
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const inner = match.slice(3, -3).replace(/^\w*\n/, '')
    return `<pre style="background:rgba(255,255,255,0.04);padding:12px;border-radius:6px;overflow-x:auto;font-family:var(--font-mono);font-size:var(--text-xs);line-height:1.5"><code>${inner}</code></pre>`
  })

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--glass-border);margin:12px 0">')

  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')

  // Links
  html = html.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" style="color:var(--accent-blue);text-decoration:none">$1</a>',
  )

  // Paragraphs (double newline)
  html = html.replace(/\n\n/g, '</p><p>')
  html = `<p>${html}</p>`
  html = html.replace(/<p><\/p>/g, '')

  return html
}

// --- Main FileNode component ---

interface FileNodeProps {
  node: CanvasNode
}

export function FileNode({ node }: FileNodeProps) {
  const filePath = node.metadata.filePath as string | undefined
  const [fileSize, setFileSize] = useState<number | null>(null)

  // Fetch file stat for size info
  useEffect(() => {
    if (!filePath) return
    window.electronAPI
      .invoke('file:stat', filePath)
      .then((result: unknown) => {
        const r = result as { ok: boolean; size?: number }
        if (r.ok && r.size !== undefined) {
          setFileSize(r.size)
        }
      })
      .catch(() => {})
  }, [filePath])

  // Open lightbox on click (not on interactive elements which stopPropagation)
  const handleClick = useCallback(() => {
    useUIStore.getState().setLightboxNodeId(node.id)
  }, [node.id])

  if (!filePath) {
    return (
      <div style={CENTER_STYLE}>
        <FileIcon size={32} strokeWidth={1.5} />
        <span style={LABEL_STYLE}>No file selected</span>
      </div>
    )
  }

  const category = getFileCategory(filePath)

  const content = (() => {
    switch (category) {
      case 'image':
        return <ImageRenderer filePath={filePath} />
      case 'code':
        return <CodeRenderer filePath={filePath} />
      case 'markdown':
        return <MarkdownRenderer filePath={filePath} />
      case 'pdf':
        return <PdfRenderer filePath={filePath} />
      case 'audio':
        return <AudioRenderer filePath={filePath} />
      case 'video':
        return <VideoRenderer filePath={filePath} />
      default:
        return <UnknownRenderer filePath={filePath} fileSize={fileSize} />
    }
  })()

  return (
    <div onClick={handleClick} style={{ width: '100%', height: '100%', cursor: 'pointer' }}>
      {content}
    </div>
  )
}
