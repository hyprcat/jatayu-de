import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { estimateTokens, formatTokenCount } from '../../lib/tokenEstimate'
import { useSettingsStore } from '../../stores'
import type { ChatMessage } from '../../stores'

const TOKEN_WARNING_THRESHOLD = 50_000

interface TokenCounterProps {
  messages: ChatMessage[]
  agentName: string
  agentId: string
}

export function TokenCounter({ messages, agentName, agentId }: TokenCounterProps) {
  const [panelOpen, setPanelOpen] = useState(false)

  // Estimate total tokens for all messages
  const { totalTokens, perMessage, toolCallTokens } = useMemo(() => {
    let total = 0
    let toolCalls = 0
    const perMsg: { id: string; role: string; tokens: number; toolName?: string }[] = []

    for (const msg of messages) {
      const msgTokens = estimateTokens(msg.content)
      let tcTokens = 0
      if (msg.toolCall) {
        tcTokens =
          estimateTokens(JSON.stringify(msg.toolCall.args)) +
          estimateTokens(msg.toolCall.output ?? '') +
          estimateTokens(msg.toolCall.error ?? '')
        toolCalls += tcTokens
      }
      const t = msgTokens + tcTokens
      total += t
      perMsg.push({
        id: msg.id,
        role: msg.role,
        tokens: t,
        toolName: msg.toolCall?.toolName,
      })
    }

    return { totalTokens: total, perMessage: perMsg, toolCallTokens: toolCalls }
  }, [messages])

  // Track monthly token usage
  useEffect(() => {
    if (totalTokens > 0) {
      useSettingsStore.getState().trackTokenUsage(agentId, agentName, 0)
    }
  }, []) // Track once on mount — actual accumulation happens on message send

  const isWarning = totalTokens >= TOKEN_WARNING_THRESHOLD

  const handleClick = useCallback(() => {
    setPanelOpen((o) => !o)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Token usage: ${formatTokenCount(totalTokens)}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-body)',
          color: isWarning ? 'var(--accent-orange)' : 'var(--text-secondary)',
        }}
      >
        {isWarning && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent-orange)',
              flexShrink: 0,
            }}
          />
        )}
        {formatTokenCount(totalTokens)} tokens
      </button>

      <AnimatePresence>
        {panelOpen && (
          <TokenBreakdownPanel
            totalTokens={totalTokens}
            toolCallTokens={toolCallTokens}
            perMessage={perMessage}
            isWarning={isWarning}
            agentName={agentName}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// --- Token Breakdown Panel ---

function TokenBreakdownPanel({
  totalTokens,
  toolCallTokens,
  perMessage,
  isWarning,
  agentName,
  onClose,
}: {
  totalTokens: number
  toolCallTokens: number
  perMessage: { id: string; role: string; tokens: number; toolName?: string }[]
  isWarning: boolean
  agentName: string
  onClose: () => void
}) {
  const modelPricing = useSettingsStore((s) => s.modelPricing)

  // Close on Esc / click-outside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-token-panel]')) onClose()
    }
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', onClick)
    }, 0)
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Estimated cost (use first model pricing as default)
  const defaultPrice = modelPricing[0]?.pricePerKToken ?? 0.03
  const estimatedCost = (totalTokens / 1000) * defaultPrice

  const userTokens = perMessage.filter((m) => m.role === 'user').reduce((sum, m) => sum + m.tokens, 0)
  const agentTokens = perMessage.filter((m) => m.role === 'agent').reduce((sum, m) => sum + m.tokens, 0)

  const ROW: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '5px 0',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-body)',
  }

  return createPortal(
    <motion.div
      data-token-panel
      className="glass"
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', duration: 0.25 }}
      style={{
        position: 'fixed',
        top: 80,
        right: 60,
        width: 280,
        zIndex: 1100,
        borderRadius: 12,
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
        }}
      >
        Token Usage — {agentName}
      </div>

      <div style={ROW}>
        <span style={{ color: 'var(--text-secondary)' }}>Total</span>
        <span
          style={{
            color: isWarning ? 'var(--accent-orange)' : 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
          }}
        >
          {formatTokenCount(totalTokens)}
        </span>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--glass-border)',
          marginTop: 4,
          paddingTop: 4,
        }}
      >
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            marginBottom: 4,
          }}
        >
          Conversation
        </div>
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>Your messages</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {formatTokenCount(userTokens)}
          </span>
        </div>
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>Agent responses</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {formatTokenCount(agentTokens)}
          </span>
        </div>
      </div>

      {toolCallTokens > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--glass-border)',
            marginTop: 4,
            paddingTop: 4,
          }}
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              marginBottom: 4,
            }}
          >
            Tool Calls
          </div>
          <div style={ROW}>
            <span style={{ color: 'var(--text-secondary)' }}>Tool I/O</span>
            <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {formatTokenCount(toolCallTokens)}
            </span>
          </div>
        </div>
      )}

      <div
        style={{
          borderTop: '1px solid var(--glass-border)',
          marginTop: 4,
          paddingTop: 4,
        }}
      >
        <div style={ROW}>
          <span style={{ color: 'var(--text-secondary)' }}>Estimated cost</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            ${estimatedCost.toFixed(4)}
          </span>
        </div>
      </div>

      {isWarning && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            marginTop: 8,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(255, 159, 10, 0.08)',
            border: '1px solid rgba(255, 159, 10, 0.2)',
          }}
        >
          <AlertCircle
            size={14}
            strokeWidth={1.75}
            style={{ color: 'var(--accent-orange)', flexShrink: 0, marginTop: 1 }}
          />
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--accent-orange)',
              lineHeight: 1.4,
            }}
          >
            Long conversation — consider starting fresh for better results
          </span>
        </div>
      )}
    </motion.div>,
    document.body,
  )
}
