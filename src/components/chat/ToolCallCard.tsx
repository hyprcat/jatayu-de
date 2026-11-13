import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Zap, ChevronDown, Copy, Check, Loader2 } from 'lucide-react'
import type { ToolCall } from '../../stores'

// --- ToolCallCard ---

export function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const toggle = useCallback(() => setExpanded((v) => !v), [])

  const handleCopy = useCallback(() => {
    const text = JSON.stringify({ input: toolCall.args, output: toolCall.output ?? toolCall.error }, null, 2)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [toolCall])

  // Compute duration string
  const duration =
    toolCall.completedAt && toolCall.startedAt ? formatDuration(toolCall.completedAt - toolCall.startedAt) : null

  // Truncate arg preview for collapsed view
  const argPreview = truncateArgs(toolCall.args)

  // Border color based on status
  const borderColor =
    toolCall.status === 'success'
      ? 'var(--accent-green)'
      : toolCall.status === 'error'
        ? 'var(--accent-red)'
        : 'var(--text-tertiary)'

  return (
    <motion.div
      animate={
        toolCall.status === 'running'
          ? { borderLeftColor: ['var(--text-tertiary)', 'rgba(255,255,255,0.15)', 'var(--text-tertiary)'] }
          : undefined
      }
      transition={toolCall.status === 'running' ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        borderLeft: `2px solid ${borderColor}`,
        overflow: 'hidden',
      }}
      role="article"
      aria-label={`Tool call: ${toolCall.toolName}`}
      aria-live="polite"
    >
      {/* Collapsed header */}
      <button
        type="button"
        onClick={toggle}
        aria-label={expanded ? 'Collapse tool call' : 'Expand tool call'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '8px 10px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-sm)',
          textAlign: 'left',
        }}
      >
        <Zap size={14} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {toolCall.toolName}
          <span style={{ color: 'var(--text-tertiary)' }}>({argPreview})</span>
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ flexShrink: 0, display: 'flex' }}
        >
          <ChevronDown size={14} strokeWidth={1.75} />
        </motion.span>
      </button>

      {/* Status line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 10px 8px 30px',
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-body)',
          color: 'var(--text-tertiary)',
        }}
      >
        {toolCall.status === 'running' && (
          <>
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ display: 'flex' }}
            >
              <Loader2 size={12} strokeWidth={1.75} />
            </motion.span>
            <span>Running…</span>
          </>
        )}
        {toolCall.status === 'success' && (
          <span>
            <span style={{ color: 'var(--accent-green)' }}>✓</span> {toolCall.summary ?? 'Done'}
            {duration && <span> · {duration}</span>}
          </span>
        )}
        {toolCall.status === 'error' && (
          <span>
            <span style={{ color: 'var(--accent-red)' }}>✗</span> {toolCall.error ?? 'Failed'}
            {duration && <span> · {duration}</span>}
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            padding: '0 10px 10px 10px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {/* Input args */}
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-body)',
                color: 'var(--text-tertiary)',
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Input
            </div>
            <pre
              style={{
                margin: 0,
                padding: 8,
                borderRadius: 6,
                background: 'rgba(0,0,0,0.2)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                overflow: 'auto',
                maxHeight: 120,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {(toolCall.output || toolCall.error) && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-body)',
                  color: 'var(--text-tertiary)',
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Output
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  borderRadius: 6,
                  background: 'rgba(0,0,0,0.2)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                  color: toolCall.error ? 'var(--accent-red)' : 'var(--text-secondary)',
                  overflow: 'auto',
                  maxHeight: 120,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {truncateOutput(toolCall.error ?? toolCall.output ?? '')}
              </pre>
            </div>
          )}

          {/* Copy button */}
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy tool call data"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-body)',
              }}
              className="glass-button"
            >
              {copied ? <Check size={12} strokeWidth={1.75} /> : <Copy size={12} strokeWidth={1.75} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// --- Compact tool call list for background agent notifications ---

export function ToolCallCompactList({ toolCalls, elapsed }: { toolCalls: ToolCall[]; elapsed: number }) {
  const done = toolCalls.filter((t) => t.status !== 'running').length

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-secondary)',
      }}
    >
      {toolCalls.map((tc) => (
        <div
          key={tc.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 0',
          }}
        >
          <Zap size={10} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {tc.toolName}
          </span>
          <span style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
            ({done}/{toolCalls.length} done)
          </span>
        </div>
      ))}
      <div
        style={{
          marginTop: 4,
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {toolCalls.length} tools called · {formatDuration(elapsed)}
      </div>
    </div>
  )
}

// --- Helpers ---

function truncateArgs(args: Record<string, unknown>): string {
  const str = Object.values(args)
    .map((v) => (typeof v === 'string' ? `"${v}"` : JSON.stringify(v)))
    .join(', ')
  return str.length > 40 ? str.slice(0, 40) + '…' : str
}

function truncateOutput(output: string, maxLength = 500): string {
  return output.length > maxLength ? output.slice(0, maxLength) + '\n…(truncated)' : output
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const sec = (ms / 1000).toFixed(1)
  return `${sec}s`
}
