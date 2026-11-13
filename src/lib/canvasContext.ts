import { useCanvasStore } from '../stores'
import { getTerminalBuffer } from './terminalRegistry'

const TEXT_EXTENSIONS = new Set([
  'py',
  'js',
  'ts',
  'tsx',
  'jsx',
  'json',
  'md',
  'yaml',
  'yml',
  'html',
  'css',
  'scss',
  'less',
  'toml',
  'cfg',
  'ini',
  'xml',
  'sh',
  'bash',
  'rb',
  'go',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'rs',
  'swift',
  'kt',
  'txt',
  'csv',
  'log',
  'sql',
  'graphql',
  'env',
  'conf',
  'makefile',
])

function isTextFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return TEXT_EXTENSIONS.has(ext)
}

export interface CanvasContext {
  nodes: CanvasContextNode[]
}

export interface CanvasContextNode {
  type: string
  title: string
  position: { x: number; y: number }
  history?: string
  cdpUrl?: string
  filePath?: string
  content?: string
}

/** Serialize current canvas state into a context object for agent consumption */
export async function buildCanvasContext(): Promise<CanvasContext> {
  const { nodes } = useCanvasStore.getState()

  const contextNodes = await Promise.all(
    nodes.map(async (node): Promise<CanvasContextNode> => {
      const base: CanvasContextNode = {
        type: node.type,
        title: node.title,
        position: node.position,
      }

      if (node.type === 'terminal') {
        base.history = getTerminalBuffer(node.id, 200)
        return base
      }

      if (node.type === 'browser' || node.type === 'webapp') {
        base.cdpUrl = (node.metadata.cdpUrl as string) || ''
        return base
      }

      if (node.type === 'file') {
        const filePath = node.metadata.filePath as string
        base.filePath = filePath || ''
        if (filePath && isTextFile(filePath)) {
          try {
            const result = (await window.electronAPI.invoke('file:readText', filePath)) as {
              ok: boolean
              content?: string
            }
            if (result.ok && result.content) {
              base.content = result.content
            }
          } catch {
            // File read failed — omit content
          }
        }
        return base
      }

      return base
    }),
  )

  return { nodes: contextNodes }
}
