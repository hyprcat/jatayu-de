import { useState, useCallback, useRef, useEffect } from 'react'
import { useCanvasStore } from '../../stores'
import type { CanvasNode } from '../../stores'

interface NoteNodeProps {
  node: CanvasNode
}

export function NoteNode({ node }: NoteNodeProps) {
  const content = (node.metadata.noteContent as string) ?? ''
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setText((node.metadata.noteContent as string) ?? '')
  }, [node.metadata.noteContent])

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(text.length, text.length)
    }
  }, [editing, text.length])

  const commitEdit = useCallback(() => {
    setEditing(false)
    if (text !== content) {
      useCanvasStore.getState().updateNode(node.id, {
        metadata: { ...node.metadata, noteContent: text },
      })
    }
  }, [text, content, node.id, node.metadata])

  const handleDoubleClick = useCallback(() => {
    setEditing(true)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        commitEdit()
      }
    },
    [commitEdit],
  )

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        width: '100%',
        height: '100%',
        padding: 10,
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-primary)',
        lineHeight: 1.5,
        overflow: 'auto',
        cursor: editing ? 'text' : 'default',
      }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
            padding: 0,
          }}
        />
      ) : (
        <div
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            minHeight: '100%',
          }}
        >
          {content || (
            <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Double-click to edit...</span>
          )}
        </div>
      )}
    </div>
  )
}
