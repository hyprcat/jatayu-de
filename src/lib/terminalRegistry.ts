import type { Terminal } from '@xterm/xterm'

const terminalInstances = new Map<string, Terminal>()

export function registerTerminal(nodeId: string, term: Terminal) {
  terminalInstances.set(nodeId, term)
}

export function unregisterTerminal(nodeId: string) {
  terminalInstances.delete(nodeId)
}

/** Extract the last N lines from a terminal's scrollback buffer */
export function getTerminalBuffer(nodeId: string, maxLines = 200): string {
  const term = terminalInstances.get(nodeId)
  if (!term) return ''
  const buffer = term.buffer.active
  const lines: string[] = []
  const startLine = Math.max(0, buffer.length - maxLines)
  for (let i = startLine; i < buffer.length; i++) {
    const line = buffer.getLine(i)
    if (line) lines.push(line.translateToString(true))
  }
  return lines.join('\n')
}
