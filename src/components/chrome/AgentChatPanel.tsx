import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, SlidersHorizontal, Paperclip, ArrowUp, ChevronDown } from 'lucide-react'
import { GlassButton } from '../glass'
import { ToolCallCard } from '../chat'
import { TokenCounter } from './TokenCounter'
import { useUIStore, useAgentStore, useCanvasStore, conversationKey } from '../../stores'
import type { Agent, ChatMessage } from '../../stores'

// --- Tab segment type ---

type TabSegment = 'agent' | 'conversations'

// --- AgentChatPanel ---

export function AgentChatPanel() {
  const isOpen = useUIStore((s) => s.agentPanelOpen)
  const activeAgentId = useUIStore((s) => s.activeAgentId)
  const agents = useAgentStore((s) => s.agents)
  const conversations = useAgentStore((s) => s.conversations)
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId)
  const isDraggingFile = useUIStore((s) => s.isDraggingFile)

  const [activeTab, setActiveTab] = useState<TabSegment>('agent')
  const [panelWidth, setPanelWidth] = useState(380)
  const [inputValue, setInputValue] = useState('')
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false)

  const resizingRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const agentDropdownRef = useRef<HTMLDivElement>(null)

  // Resolve active agent
  const activeAgent: Agent | undefined = agents.find((a) => a.id === activeAgentId)

  // Conversation key for current agent + canvas
  const convKey = activeAgentId ? conversationKey(activeAgentId, activeCanvasId) : null

  const messages: ChatMessage[] = convKey ? (conversations[convKey]?.messages ?? []) : []

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setAgentDropdownOpen(false)
    }
  }, [isOpen])

  // Close agent dropdown on click-outside
  useEffect(() => {
    if (!agentDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setAgentDropdownOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAgentDropdownOpen(false)
    }
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick)
    }, 0)
    window.addEventListener('keydown', handleEsc)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [agentDropdownOpen])

  // Send message
  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text || !activeAgentId || !convKey) return

    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    useAgentStore.getState().addMessage(convKey, msg)
    setInputValue('')

    // IPC call to Orbiter (if available)
    if (window.electronAPI) {
      window.electronAPI.invoke('agent:stream', activeAgentId, text, { canvasId: activeCanvasId }).catch(() => {
        // Orbiter not connected — silently ignore for now
      })
    }
  }, [inputValue, activeAgentId, convKey])

  // Handle keydown in input
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // Resize handle drag
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      resizingRef.current = true
      const startX = e.clientX
      const startWidth = panelWidth

      const onMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return
        // Dragging left increases width (panel is on right)
        setPanelWidth(Math.min(520, Math.max(320, startWidth - (ev.clientX - startX))))
      }
      const onUp = () => {
        resizingRef.current = false
        document.body.style.cursor = ''
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.body.style.cursor = 'col-resize'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [panelWidth],
  )

  // Switch active agent
  const handleSelectAgent = useCallback((agentId: string) => {
    useUIStore.getState().setActiveAgentId(agentId)
    setAgentDropdownOpen(false)
  }, [])

  // All conversation keys for current canvas
  const canvasConversationKeys = Object.keys(conversations).filter((k) => k.endsWith(`:${activeCanvasId}`))

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
          className="glass"
          onFocus={() => useUIStore.getState().setFocusLayer('panel')}
          tabIndex={-1}
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            bottom: 16,
            width: panelWidth,
            zIndex: 500,
            borderRadius: '14px 0 0 14px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          role="complementary"
          aria-label="Agent chat panel"
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 12px 8px 12px',
              flexShrink: 0,
            }}
          >
            {/* Tab bar pill */}
            <div
              className="glass-pill"
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 1,
                height: 36,
                borderRadius: 999,
                padding: 3,
                position: 'relative',
              }}
            >
              {/* Sliding active indicator */}
              <motion.div
                layout
                style={{
                  position: 'absolute',
                  top: 3,
                  bottom: 3,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.1)',
                  zIndex: 0,
                  left: activeTab === 'agent' ? 3 : '50%',
                  width: 'calc(50% - 3px)',
                }}
                transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
              />

              {/* Agent segment */}
              <button
                type="button"
                onClick={() => setActiveTab('agent')}
                aria-label="Active agent tab"
                style={{
                  flex: 1,
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  color: activeTab === 'agent' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                {activeAgent?.name ?? 'No Agent'}
                <ChevronDown size={12} strokeWidth={1.75} style={{ opacity: 0.5 }} />
              </button>

              {/* Conversations segment */}
              <button
                type="button"
                onClick={() => setActiveTab('conversations')}
                aria-label="Conversations tab"
                style={{
                  flex: 1,
                  height: '100%',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  color: activeTab === 'conversations' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                Conversations
              </button>
            </div>

            {/* Settings button */}
            <motion.div whileHover={{ rotate: 15 }} transition={{ type: 'spring', duration: 0.2 }}>
              <GlassButton
                aria-label="Agent settings"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                }}
              >
                <SlidersHorizontal size={18} strokeWidth={1.75} />
              </GlassButton>
            </motion.div>

            {/* Close button */}
            <GlassButton aria-label="Close agent panel" onClick={() => useUIStore.getState().setAgentPanelOpen(false)}>
              <X size={16} strokeWidth={1.75} />
            </GlassButton>
          </div>

          {/* Agent dropdown (when clicking agent tab segment) */}
          {activeTab === 'agent' && (
            <AgentDropdownTrigger
              agentDropdownOpen={agentDropdownOpen}
              onToggle={() => setAgentDropdownOpen((o) => !o)}
              agentDropdownRef={agentDropdownRef}
              agents={agents}
              activeAgentId={activeAgentId}
              onSelectAgent={handleSelectAgent}
            />
          )}

          {/* Token counter */}
          {activeTab === 'agent' && activeAgent && messages.length > 0 && (
            <div
              style={{
                padding: '0 14px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                }}
              >
                {activeAgent.name} ·
              </span>
              <TokenCounter messages={messages} agentName={activeAgent.name} agentId={activeAgent.id} />
            </div>
          )}

          {/* Content area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {activeTab === 'agent' ? (
              <>
                {/* Messages area */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '8px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {!activeAgent && (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-tertiary)',
                        fontSize: 'var(--text-sm)',
                        fontFamily: 'var(--font-body)',
                        textAlign: 'center',
                        padding: 24,
                      }}
                    >
                      No agent selected. Create an agent in Settings or select one from the Agents menu.
                    </div>
                  )}

                  {activeAgent && messages.length === 0 && (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-tertiary)',
                        fontSize: 'var(--text-sm)',
                        fontFamily: 'var(--font-body)',
                        textAlign: 'center',
                        padding: 24,
                      }}
                    >
                      Start a conversation with {activeAgent.name}
                    </div>
                  )}

                  {messages.map((msg) =>
                    msg.role === 'tool_call' && msg.toolCall ? (
                      <ToolCallCard key={msg.id} toolCall={msg.toolCall} />
                    ) : (
                      <MessageBubble key={msg.id} message={msg} />
                    ),
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input bar */}
                {activeAgent && (
                  <div
                    style={{
                      flexShrink: 0,
                      padding: '8px 12px 12px',
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 6,
                      borderTop: isDraggingFile ? '2px solid var(--accent-blue)' : '1px solid transparent',
                      transition: 'border-color 200ms',
                    }}
                    className={isDraggingFile ? 'drop-zone-pulse' : ''}
                  >
                    <GlassButton aria-label="Attach file">
                      <Paperclip size={16} strokeWidth={1.75} />
                    </GlassButton>

                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder={`Message ${activeAgent.name}...`}
                      className="glass-input"
                      rows={1}
                      aria-label={`Message ${activeAgent.name}`}
                      style={{
                        flex: 1,
                        resize: 'none',
                        minHeight: 36,
                        maxHeight: 120,
                        padding: '8px 12px',
                        lineHeight: 1.4,
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-sm)',
                      }}
                    />

                    <GlassButton
                      aria-label="Send message"
                      onClick={handleSend}
                      style={{
                        background: inputValue.trim() ? 'var(--accent-blue)' : undefined,
                        borderColor: inputValue.trim() ? 'var(--accent-blue)' : undefined,
                      }}
                    >
                      <ArrowUp size={16} strokeWidth={1.75} />
                    </GlassButton>
                  </div>
                )}
              </>
            ) : (
              /* Conversations tab */
              <ConversationsList
                canvasConversationKeys={canvasConversationKeys}
                conversations={conversations}
                agents={agents}
                onSelectConversation={(agentId) => {
                  useUIStore.getState().setActiveAgentId(agentId)
                  setActiveTab('agent')
                }}
              />
            )}
          </div>

          {/* Resize Handle (left edge) */}
          <div
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute',
              top: 0,
              left: -3,
              bottom: 0,
              width: 6,
              cursor: 'col-resize',
              zIndex: 10,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- Agent Dropdown Trigger ---

function AgentDropdownTrigger({
  agentDropdownOpen,
  onToggle,
  agentDropdownRef,
  agents,
  activeAgentId,
  onSelectAgent,
}: {
  agentDropdownOpen: boolean
  onToggle: () => void
  agentDropdownRef: React.RefObject<HTMLDivElement | null>
  agents: Agent[]
  activeAgentId: string | null
  onSelectAgent: (id: string) => void
}) {
  if (agents.length === 0) return null

  return (
    <div
      style={{
        padding: '0 12px 4px',
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label="Switch agent"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          padding: '4px 8px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-body)',
          cursor: 'pointer',
          borderRadius: 6,
        }}
        className="glass-button"
      >
        Switch agent
        <ChevronDown
          size={12}
          strokeWidth={1.75}
          style={{
            transform: agentDropdownOpen ? 'rotate(180deg)' : undefined,
            transition: 'transform 200ms',
          }}
        />
      </button>

      <AnimatePresence>
        {agentDropdownOpen && (
          <motion.div
            ref={agentDropdownRef}
            className="glass"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ type: 'spring', duration: 0.2 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 12,
              right: 12,
              zIndex: 10,
              borderRadius: 10,
              padding: 4,
              marginTop: 2,
            }}
          >
            {agents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelectAgent(agent.id)}
                className="glass-button"
                aria-label={`Switch to ${agent.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  height: 32,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: agent.id === activeAgentId ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: agent.color,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 600,
                    color: '#fff',
                  }}
                >
                  {agent.name.charAt(0).toUpperCase()}
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {agent.name}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- Message Bubble ---

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)',
          color: isUser ? '#fff' : 'var(--text-primary)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-body)',
          lineHeight: 1.5,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
        role="article"
        aria-label={`${isUser ? 'You' : 'Agent'}: ${message.content.slice(0, 60)}`}
      >
        {message.content}
      </div>
    </div>
  )
}

// --- Conversations List ---

function ConversationsList({
  canvasConversationKeys,
  conversations,
  agents,
  onSelectConversation,
}: {
  canvasConversationKeys: string[]
  conversations: Record<string, { messages: ChatMessage[] }>
  agents: Agent[]
  onSelectConversation: (agentId: string) => void
}) {
  if (canvasConversationKeys.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-body)',
          textAlign: 'center',
          padding: 24,
        }}
      >
        No conversations yet.
        <br />
        Start chatting with an agent!
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 12px',
      }}
    >
      {canvasConversationKeys.map((key) => {
        const agentId = key.split(':')[0]
        const agent = agents.find((a) => a.id === agentId)
        const conv = conversations[key]
        const lastMsg = conv?.messages[conv.messages.length - 1]

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectConversation(agentId)}
            className="glass-button"
            aria-label={`Conversation with ${agent?.name ?? 'Unknown'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '10px 8px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {/* Agent circle */}
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: agent?.color ?? 'var(--text-tertiary)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              {agent?.name.charAt(0).toUpperCase() ?? '?'}
            </span>

            <div
              style={{
                flex: 1,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {agent?.name ?? 'Unknown Agent'}
              </div>
              {lastMsg && (
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 2,
                  }}
                >
                  {lastMsg.content.slice(0, 80)}
                </div>
              )}
            </div>

            {/* Message count */}
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
                flexShrink: 0,
              }}
            >
              {conv?.messages.length ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}
