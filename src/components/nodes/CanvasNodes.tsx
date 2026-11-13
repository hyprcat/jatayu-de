import { useMemo } from 'react'
import { useCanvasStore, useUIStore } from '../../stores'
import type { NodeType, CanvasNode } from '../../stores'
import { NodeShell } from './NodeShell'
import { TerminalNode } from './TerminalNode'
import { BrowserNode } from './BrowserNode'
import { FileNode } from './FileNode'
import { WebAppNode } from './WebAppNode'
import { NoteNode } from './NoteNode'
import { GroupContainer } from './GroupContainer'
import { TerminalSquare, Globe, AppWindow, FileText, StickyNote } from 'lucide-react'

const NODE_ICONS: Record<NodeType, React.ReactNode> = {
  terminal: <TerminalSquare size={32} strokeWidth={1.5} />,
  browser: <Globe size={32} strokeWidth={1.5} />,
  webapp: <AppWindow size={32} strokeWidth={1.5} />,
  file: <FileText size={32} strokeWidth={1.5} />,
  note: <StickyNote size={32} strokeWidth={1.5} />,
}

function NodeContent({ node }: { node: CanvasNode }) {
  if (node.type === 'terminal') {
    return <TerminalNode node={node} />
  }

  if (node.type === 'browser') {
    return <BrowserNode node={node} />
  }

  if (node.type === 'file') {
    return <FileNode node={node} />
  }

  if (node.type === 'webapp') {
    return <WebAppNode node={node} />
  }

  if (node.type === 'note') {
    return <NoteNode node={node} />
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-tertiary)',
        flexDirection: 'column',
        gap: 8,
        fontSize: 'var(--text-sm)',
        fontFamily: 'var(--font-body)',
        userSelect: 'none',
      }}
    >
      {NODE_ICONS[node.type]}
      <span>{node.type}</span>
    </div>
  )
}

export function CanvasNodes() {
  const nodes = useCanvasStore((s) => s.nodes)
  const groups = useCanvasStore((s) => s.groups)
  const collapsedGroupIds = useUIStore((s) => s.collapsedGroupIds)

  // Build a set of hidden node IDs (nodes in collapsed groups)
  const hiddenNodeIds = useMemo(() => {
    const hidden = new Set<string>()
    for (const group of groups) {
      if (collapsedGroupIds.has(group.id)) {
        for (const nid of group.nodeIds) {
          hidden.add(nid)
        }
      }
    }
    return hidden
  }, [groups, collapsedGroupIds])

  // Build node map for quick lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, CanvasNode>()
    for (const n of nodes) map.set(n.id, n)
    return map
  }, [nodes])

  return (
    <>
      {/* Groups rendered first (behind nodes at z-index 0) */}
      {groups.map((group) => {
        const memberNodes = group.nodeIds.map((nid) => nodeMap.get(nid)).filter((n): n is CanvasNode => !!n)
        if (memberNodes.length === 0) return null
        return <GroupContainer key={group.id} group={group} memberNodes={memberNodes} />
      })}

      {/* Nodes — skip hidden nodes in collapsed groups */}
      {nodes.map((node) => {
        if (hiddenNodeIds.has(node.id)) return null
        return (
          <NodeShell key={node.id} node={node}>
            <NodeContent node={node} />
          </NodeShell>
        )
      })}
    </>
  )
}
