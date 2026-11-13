import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, FolderOpen, Bot, Sparkles, Check, X } from 'lucide-react'
import { GlassInput } from '../glass'
import { useSettingsStore, useUIStore, useAgentStore, useCanvasStore } from '../../stores'
import { useFocusTrap } from '../../hooks/useFocusTrap'

type OnboardingStep = 'welcome' | 'workspace' | 'agent' | 'tour-spotlight' | 'tour-terminal' | 'tour-agent' | 'done'

const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'workspace',
  'agent',
  'tour-spotlight',
  'tour-terminal',
  'tour-agent',
  'done',
]

function getStepGroup(step: OnboardingStep): number {
  if (step === 'welcome') return 0
  if (step === 'workspace') return 1
  if (step === 'agent') return 2
  return 3 // tour steps + done
}

const TOTAL_DOTS = 4

// --- Animated illustration: staggered node circles ---

function NodesIllustration() {
  const reducedMotion = useReducedMotion()
  const nodes = [
    { x: 120, y: 80, w: 90, h: 60, color: 'var(--accent-blue)', delay: 0 },
    { x: 240, y: 130, w: 80, h: 55, color: 'var(--accent-green)', delay: 0.15 },
    { x: 180, y: 200, w: 100, h: 50, color: 'var(--accent-purple)', delay: 0.3 },
    { x: 310, y: 60, w: 70, h: 50, color: 'var(--accent-orange)', delay: 0.45 },
  ]

  return (
    <svg width={440} height={280} viewBox="0 0 440 280" style={{ display: 'block', margin: '0 auto' }}>
      {/* Connection lines */}
      <motion.line
        x1={165}
        y1={110}
        x2={280}
        y2={157}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      />
      <motion.line
        x1={230}
        y1={225}
        x2={280}
        y2={157}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.7, duration: 0.4 }}
      />
      <motion.line
        x1={280}
        y1={130}
        x2={345}
        y2={85}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.8, duration: 0.4 }}
      />
      {/* Nodes */}
      {nodes.map((n, i) => (
        <motion.rect
          key={i}
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          rx={10}
          fill={n.color}
          fillOpacity={0.15}
          stroke={n.color}
          strokeWidth={1}
          strokeOpacity={0.3}
          initial={reducedMotion ? {} : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            delay: n.delay,
            type: 'spring',
            duration: 0.5,
            bounce: 0.3,
          }}
          style={{ transformOrigin: `${n.x + n.w / 2}px ${n.y + n.h / 2}px` }}
        />
      ))}
    </svg>
  )
}

// --- Step Progress Dots ---

function StepDots({ current }: { current: number }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        marginTop: 20,
      }}
    >
      {Array.from({ length: TOTAL_DOTS }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background:
              i === current ? 'var(--accent-blue)' : i < current ? 'var(--text-secondary)' : 'rgba(255,255,255,0.12)',
            transition: 'background 200ms',
          }}
        />
      ))}
    </div>
  )
}

// --- Button styles ---

const PRIMARY_BTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 24px',
  borderRadius: 10,
  border: 'none',
  background: 'var(--accent-blue)',
  color: '#fff',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
  transition: 'opacity 150ms',
}

const SKIP_BTN: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-tertiary)',
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
}

// --- Highlight overlay for tour steps ---

function HighlightOverlay({
  targetSelector,
  tooltipText,
  tooltipSubtext,
  position,
}: {
  targetSelector: string
  tooltipText: string
  tooltipSubtext?: string
  position?: 'top' | 'bottom' | 'right'
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const find = () => {
      const el = document.querySelector(targetSelector)
      if (el) {
        setRect(el.getBoundingClientRect())
      }
    }
    find()
    const interval = setInterval(find, 500)
    return () => clearInterval(interval)
  }, [targetSelector])

  if (!rect) return null

  const pad = 8
  const pos = position ?? 'bottom'
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 2002,
    background: 'var(--glass-bg)',
    border: '1px solid var(--accent-blue)',
    borderRadius: 12,
    padding: '12px 16px',
    maxWidth: 280,
    backdropFilter: 'blur(12px)',
    ...(pos === 'bottom'
      ? { top: rect.bottom + 12, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' }
      : pos === 'top'
        ? {
            bottom: window.innerHeight - rect.top + 12,
            left: rect.left + rect.width / 2,
            transform: 'translateX(-50%)',
          }
        : { top: rect.top + rect.height / 2, left: rect.right + 12, transform: 'translateY(-50%)' }),
  }

  return (
    <>
      {/* Darkened overlay with cutout */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2001,
          pointerEvents: 'none',
        }}
      >
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <mask id="onboarding-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - pad}
                y={rect.top - pad}
                width={rect.width + pad * 2}
                height={rect.height + pad * 2}
                rx={12}
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#onboarding-mask)" />
        </svg>
        {/* Highlight ring */}
        <div
          style={{
            position: 'fixed',
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            borderRadius: 12,
            border: '2px solid var(--accent-blue)',
            pointerEvents: 'none',
            boxShadow: '0 0 20px rgba(10,132,255,0.3)',
          }}
        />
      </div>
      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={tooltipStyle}
      >
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            fontWeight: 600,
            marginBottom: tooltipSubtext ? 4 : 0,
          }}
        >
          {tooltipText}
        </div>
        {tooltipSubtext && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
            }}
          >
            {tooltipSubtext}
          </div>
        )}
      </motion.div>
    </>
  )
}

// --- Main OnboardingFlow ---

export function OnboardingFlow() {
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete)
  const reducedMotion = useReducedMotion()
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const overlayRef = useRef<HTMLDivElement>(null)
  useFocusTrap(overlayRef, !onboardingComplete)
  const [workspaceDir, setWorkspaceDir] = useState('~/Flow/')
  const [provider, setProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'valid' | 'error'>('idle')

  const finish = useCallback(() => {
    useSettingsStore.getState().setOnboardingComplete(true)
  }, [])

  const skip = useCallback(() => {
    finish()
  }, [finish])

  const next = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step)
    if (idx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[idx + 1])
    }
  }, [step])

  // Step 1: save workspace dir on next
  const handleWorkspaceNext = useCallback(() => {
    useSettingsStore.getState().setWorkspaceDir(workspaceDir)
    next()
  }, [workspaceDir, next])

  // Step 2: validate key
  const handleValidateKey = useCallback(async () => {
    if (!apiKey.trim()) return
    setKeyStatus('validating')
    // Stub validation — in production this would call orbiter.validateKey
    await new Promise((r) => setTimeout(r, 800))
    // Accept any key that looks plausible
    if (apiKey.trim().length >= 8) {
      setKeyStatus('valid')
      // Create default assistant agent
      const agents = useAgentStore.getState().agents
      if (!agents.find((a) => a.name === 'assistant')) {
        useAgentStore.getState().addAgent({
          id: `agent-${Date.now()}`,
          name: 'assistant',
          color: 'var(--accent-blue)',
          status: 'idle',
          currentTask: '',
        })
      }
    } else {
      setKeyStatus('error')
    }
  }, [apiKey])

  const handleAgentNext = useCallback(() => {
    next()
  }, [next])

  // Tour step: watch for Spotlight open
  useEffect(() => {
    if (step !== 'tour-spotlight') return
    const unsub = useUIStore.subscribe((state) => {
      if (state.spotlightOpen) {
        // User opened Spotlight — advance
        setTimeout(() => setStep('tour-terminal'), 500)
      }
    })
    return unsub
  }, [step])

  // Tour step: watch for terminal node creation
  useEffect(() => {
    if (step !== 'tour-terminal') return
    const unsub = useCanvasStore.subscribe((state) => {
      if (state.nodes.some((n) => n.type === 'terminal')) {
        setTimeout(() => setStep('tour-agent'), 500)
      }
    })
    return unsub
  }, [step])

  // Tour step: watch for agent message
  useEffect(() => {
    if (step !== 'tour-agent') return
    const unsub = useAgentStore.subscribe((state) => {
      const hasMessages = Object.values(state.conversations).some((conv) => conv.messages.length > 0)
      if (hasMessages) {
        setTimeout(() => setStep('done'), 500)
      }
    })
    return unsub
  }, [step])

  // If onboarding is complete, don't show
  if (onboardingComplete) return null

  const stepGroup = getStepGroup(step)

  // Card-based steps (welcome, workspace, agent, done)
  const isCardStep = step === 'welcome' || step === 'workspace' || step === 'agent' || step === 'done'

  // Tour steps show highlight overlays
  const isTourStep = step === 'tour-spotlight' || step === 'tour-terminal' || step === 'tour-agent'

  return createPortal(
    <div ref={overlayRef} role="dialog" aria-label="Onboarding">
      {/* Card overlay */}
      <AnimatePresence mode="wait">
        {isCardStep && (
          <motion.div
            key={step}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              className="glass"
              style={{
                width: 520,
                maxHeight: 500,
                borderRadius: 18,
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'var(--font-body)',
                position: 'relative',
              }}
            >
              {/* Skip button */}
              {step !== 'done' && (
                <button type="button" onClick={skip} style={{ ...SKIP_BTN, position: 'absolute', top: 12, right: 12 }}>
                  <X size={16} strokeWidth={1.75} />
                </button>
              )}

              {/* Content based on step */}
              {step === 'welcome' && (
                <div style={{ textAlign: 'center' }}>
                  <NodesIllustration />
                  <h1
                    style={{
                      fontSize: 'var(--text-2xl)',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                      margin: '16px 0 8px',
                    }}
                  >
                    Welcome to Flow
                  </h1>
                  <p
                    style={{
                      fontSize: 'var(--text-base)',
                      color: 'var(--text-secondary)',
                      margin: '0 0 24px',
                    }}
                  >
                    Your AI-native workspace
                  </p>
                  <button type="button" onClick={next} style={PRIMARY_BTN}>
                    Get Started
                    <ArrowRight size={16} strokeWidth={2} />
                  </button>
                </div>
              )}

              {step === 'workspace' && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <FolderOpen size={24} strokeWidth={1.75} style={{ color: 'var(--accent-blue)' }} />
                    <h2
                      style={{
                        fontSize: 'var(--text-xl)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                        margin: 0,
                      }}
                    >
                      Workspace Setup
                    </h2>
                  </div>
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      marginBottom: 16,
                    }}
                  >
                    Choose where Flow stores your canvases and files.
                  </p>
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 6,
                      }}
                    >
                      Workspace Directory
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <GlassInput
                        value={workspaceDir}
                        onChange={(e) => setWorkspaceDir(e.target.value)}
                        aria-label="Workspace directory"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.electronAPI) return
                          const dir = (await window.electronAPI.invoke('dialog:openDirectory')) as string | null
                          if (dir) setWorkspaceDir(dir)
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid var(--glass-border)',
                          background: 'var(--glass-bg)',
                          color: 'var(--text-primary)',
                          fontSize: 'var(--text-sm)',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={handleWorkspaceNext} style={PRIMARY_BTN}>
                      Next
                      <ArrowRight size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              )}

              {step === 'agent' && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <Bot size={24} strokeWidth={1.75} style={{ color: 'var(--accent-green)' }} />
                    <h2
                      style={{
                        fontSize: 'var(--text-xl)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                        margin: 0,
                      }}
                    >
                      Agent Setup
                    </h2>
                  </div>
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      marginBottom: 16,
                    }}
                  >
                    Connect an AI model to power your workspace agents.
                  </p>

                  {/* Provider selection */}
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: 8,
                      }}
                    >
                      Model Provider
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { id: 'openai', label: 'OpenAI' },
                        { id: 'anthropic', label: 'Anthropic' },
                        { id: 'google', label: 'Google' },
                        { id: 'local', label: 'Local (Ollama)' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setProvider(p.id)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 8,
                            border:
                              provider === p.id ? '1px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                            background: provider === p.id ? 'rgba(10,132,255,0.15)' : 'var(--glass-bg)',
                            color: provider === p.id ? 'var(--accent-blue)' : 'var(--text-primary)',
                            fontSize: 'var(--text-sm)',
                            fontFamily: 'var(--font-body)',
                            cursor: 'pointer',
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* API Key */}
                  {provider && provider !== 'local' && (
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-tertiary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: 6,
                        }}
                      >
                        API Key
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="password"
                          className="glass-input"
                          value={apiKey}
                          onChange={(e) => {
                            setApiKey(e.target.value)
                            setKeyStatus('idle')
                          }}
                          placeholder="sk-..."
                          aria-label="API key"
                          style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}
                        />
                        <button
                          type="button"
                          onClick={handleValidateKey}
                          disabled={keyStatus === 'validating'}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 6,
                            border: '1px solid var(--glass-border)',
                            background: 'var(--glass-bg)',
                            color: 'var(--text-primary)',
                            fontSize: 'var(--text-sm)',
                            fontFamily: 'var(--font-body)',
                            cursor: 'pointer',
                            opacity: keyStatus === 'validating' ? 0.5 : 1,
                          }}
                        >
                          {keyStatus === 'validating' ? 'Checking...' : 'Validate'}
                        </button>
                      </div>
                      {keyStatus === 'valid' && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 6,
                            fontSize: 'var(--text-xs)',
                            color: 'var(--accent-green)',
                          }}
                        >
                          <Check size={12} strokeWidth={2} />
                          Key validated. Default &apos;assistant&apos; agent created.
                        </div>
                      )}
                      {keyStatus === 'error' && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 'var(--text-xs)',
                            color: 'var(--accent-red)',
                          }}
                        >
                          Invalid key. Please check and try again.
                        </div>
                      )}
                    </div>
                  )}

                  {provider === 'local' && (
                    <div
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--text-secondary)',
                        marginBottom: 16,
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      Local mode uses Ollama. Make sure it&apos;s running on your machine.
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" onClick={skip} style={SKIP_BTN}>
                      Skip for now
                    </button>
                    <button type="button" onClick={handleAgentNext} style={PRIMARY_BTN}>
                      Next
                      <ArrowRight size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              )}

              {step === 'done' && (
                <div style={{ textAlign: 'center' }}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', duration: 0.4, bounce: 0.4 }}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'rgba(48,209,88,0.15)',
                      border: '2px solid var(--accent-green)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <Sparkles size={28} strokeWidth={1.75} style={{ color: 'var(--accent-green)' }} />
                  </motion.div>
                  <h2
                    style={{
                      fontSize: 'var(--text-xl)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                      margin: '0 0 8px',
                    }}
                  >
                    You&apos;re ready!
                  </h2>
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      margin: '0 0 24px',
                    }}
                  >
                    Flow is set up. Open Spotlight anytime with Super+Alt+Space.
                  </p>
                  <button type="button" onClick={finish} style={PRIMARY_BTN}>
                    Start using Flow
                  </button>
                </div>
              )}

              {/* Step dots */}
              <StepDots current={stepGroup} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tour highlight overlays */}
      {isTourStep && (
        <>
          {step === 'tour-spotlight' && (
            <HighlightOverlay
              targetSelector='[aria-label="Search"]'
              tooltipText="Press Super+Alt+Space to do anything"
              tooltipSubtext="Open Spotlight to search, create nodes, and interact with agents."
              position="right"
            />
          )}
          {step === 'tour-terminal' && (
            <HighlightOverlay
              targetSelector='[aria-label="Spotlight search"]'
              tooltipText='Type "a: terminal" and press Enter'
              tooltipSubtext="This creates a terminal node on your canvas."
            />
          )}
          {step === 'tour-agent' && (
            <HighlightOverlay
              targetSelector='[aria-label="Spotlight search"]'
              tooltipText='Type "@assistant hello"'
              tooltipSubtext="Send a message to your AI agent."
            />
          )}
          {/* Skip button for tour */}
          <div
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 2100,
            }}
          >
            <button
              type="button"
              onClick={skip}
              style={{
                ...SKIP_BTN,
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 8,
                padding: '8px 16px',
              }}
            >
              Skip Tour
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
