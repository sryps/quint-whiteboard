import { useReactFlow } from '@xyflow/react'
import { useAppStore } from '../../model/store'
import type { DeclKind } from '../../model/spec'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const DECL_COLORS: Record<DeclKind, string> = {
  var: '#60a5fa',
  const: '#facc15',
  val: '#4ade80',
  def: '#a78bfa',
  action: '#fb923c',
  type: '#f472b6',
  assume: '#94a3b8',
}

export default function Toolbar({
  showExec,
  onToggleExec,
}: {
  showExec: boolean
  onToggleExec: () => void
}) {
  const moduleName = useAppStore((s) => s.moduleName)
  const setModuleName = useAppStore((s) => s.setModuleName)
  const addDeclNode = useAppStore((s) => s.addDeclNode)
  const addStateMachineNodes = useAppStore((s) => s.addStateMachineNodes)
  const undo = useAppStore((s) => s.undo)
  const redo = useAppStore((s) => s.redo)
  const clearCanvas = useAppStore((s) => s.clearCanvas)
  const toggleCodePreview = useAppStore((s) => s.toggleCodePreview)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const showCodePreview = useAppStore((s) => s.showCodePreview)
  const { screenToFlowPosition, fitView } = useReactFlow()

  const getViewportCenter = () => {
    // Get the react-flow container and its bounding rect
    const container = document.querySelector('.react-flow') as HTMLElement | null
    if (!container) {
      return screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    }
    const rect = container.getBoundingClientRect()
    // screenToFlowPosition expects screen coordinates, so use the center of the container's screen position
    return screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }

  const addAtCenter = (kind: DeclKind) => {
    const center = getViewportCenter()
    addDeclNode(kind, center.x - 70, center.y - 20)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: '#18122e',
        border: '1px solid #2a1f4e',
        borderRadius: 10,
        padding: 4,
        zIndex: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Module name input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 8px',
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: '#8878b8',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          Module:
        </span>
        <input
          type="text"
          value={moduleName}
          onChange={(e) => setModuleName(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid #2a1f4e',
            borderRadius: 5,
            padding: '5px 8px',
            color: '#e4e4f0',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600,
            outline: 'none',
            width: 100,
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#7c5cfc'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#2a1f4e'
          }}
        />
      </div>
      <Separator />

      {/* Declaration type buttons */}
      {(['var', 'const', 'action', 'def', 'val', 'type'] as DeclKind[]).map((kind) => (
        <DeclButton
          key={kind}
          kind={kind}
          color={DECL_COLORS[kind]}
          onClick={() => addAtCenter(kind)}
        />
      ))}
      <Separator />

      {/* State machine template */}
      <ToolbarButton
        label="+ State Machine"
        title="Add state machine scaffold (var + init + step + invariant)"
        accent
        onClick={() => {
          // Place at origin and use fitView to center
          addStateMachineNodes(0, 0)
          // Small delay to let nodes render before fitting
          setTimeout(() => {
            fitView({ padding: 0.15, duration: 200 })
          }, 50)
        }}
      />
      <Separator />

      <ToolbarButton label={'\u21A9'} title="Undo (Ctrl+Z)" onClick={undo} />
      <ToolbarButton label={'\u21AA'} title="Redo (Ctrl+Shift+Z)" onClick={redo} />
      <Separator />
      <ToolbarButton
        label="Code Gen"
        title="Toggle generated Quint code preview"
        active={showCodePreview}
        onClick={toggleCodePreview}
      />
      <ToolbarButton
        label={'\u25B6 Run'}
        title="Toggle execution panel"
        active={showExec}
        onClick={onToggleExec}
      />
      <Separator />
      <ToolbarButton
        label="Clear"
        title="Clear all nodes from canvas"
        danger
        onClick={() => setShowClearConfirm(true)}
      />

      {showClearConfirm && createPortal(
        <ConfirmModal
          message="Clear all nodes from the canvas?"
          onConfirm={() => { clearCanvas(); setShowClearConfirm(false) }}
          onCancel={() => setShowClearConfirm(false)}
        />,
        document.body,
      )}
    </div>
  )
}

function DeclButton({
  kind,
  color,
  onClick,
}: {
  kind: DeclKind
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={`Add ${kind} node`}
      style={{
        background: color + '15',
        color,
        border: `1px solid ${color}33`,
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'JetBrains Mono', monospace",
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = color + '30'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = color + '15'
      }}
    >
      + {kind}
    </button>
  )
}

function ToolbarButton({
  label,
  title,
  onClick,
  accent,
  active,
  danger,
}: {
  label: string
  title: string
  onClick: () => void
  accent?: boolean
  active?: boolean
  danger?: boolean
}) {
  const baseColor = danger ? '#ef4444' : '#8878b8'
  const activeColor = danger ? '#ef4444' : '#9d84fd'
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: accent
          ? 'linear-gradient(135deg, #7c5cfc, #5a3fd4)'
          : active
            ? 'rgba(124,92,252,0.15)'
            : 'transparent',
        color: accent ? '#fff' : active ? activeColor : baseColor,
        border: 'none',
        borderRadius: 7,
        padding: '7px 14px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!accent) {
          e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)'
          e.currentTarget.style.color = danger ? '#f87171' : '#e4e4f0'
        }
      }}
      onMouseLeave={(e) => {
        if (!accent) {
          e.currentTarget.style.background = active ? 'rgba(124,92,252,0.15)' : 'transparent'
          e.currentTarget.style.color = active ? activeColor : baseColor
        }
      }}
    >
      {label}
    </button>
  )
}

function Separator() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: '#2a1f4e',
        margin: '0 4px',
      }}
    />
  )
}

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    },
    [onConfirm, onCancel]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1430',
          border: '1px solid #2a1f4e',
          borderRadius: 12,
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <p style={{ color: '#e4e4f0', fontSize: 14, margin: 0 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#8878b8',
              border: '1px solid #2a1f4e',
              borderRadius: 7,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 7,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
