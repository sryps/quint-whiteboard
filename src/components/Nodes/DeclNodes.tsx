import { memo, useCallback, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { DeclNodeData, RoleGroupData } from '../../model/spec'
import { useAppStore } from '../../model/store'

// ─── Colors ────────────────────────────────────────────────────
const COLORS = {
  var: '#60a5fa',
  const: '#facc15',
  val: '#4ade80',
  def: '#a78bfa',
  action: '#fb923c',
  actionInit: '#4ade80',
  actionStep: '#fb923c',
  invariant: '#facc15',
  type: '#f472b6',
}

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  init: { label: 'INIT', color: '#4ade80' },
  step: { label: 'STEP', color: '#fb923c' },
  invariant: { label: 'INV', color: '#facc15' },
}

// ─── Shared styles ─────────────────────────────────────────────

function useNodeSelection(id: string) {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const setSelectedNode = useAppStore((s) => s.setSelectedNode)
  const isSelected = selectedNodeId === id

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedNode(id)
    },
    [id, setSelectedNode]
  )

  return { isSelected, handleClick }
}

function NodeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </>
  )
}

// ─── Pill Node (var, const, type) ──────────────────────────────

function PillNode({
  id,
  color,
  kindLabel,
  name,
  typeAnnotation,
}: {
  id: string
  color: string
  kindLabel: string
  name: string
  typeAnnotation?: string
}) {
  const { isSelected, handleClick } = useNodeSelection(id)

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#14102a',
        border: `2px solid ${isSelected ? color : '#2a1f4e'}`,
        borderRadius: 24,
        padding: '10px 18px',
        minWidth: 140,
        boxShadow: isSelected
          ? `0 0 16px ${color}33, 0 4px 16px rgba(0,0,0,0.3)`
          : '0 4px 16px rgba(0,0,0,0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
      }}
    >
      <NodeHandles />
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color,
          background: color + '22',
          padding: '2px 8px',
          borderRadius: 10,
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          flexShrink: 0,
        }}
      >
        {kindLabel}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#e4e4f0',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {name || 'unnamed'}
      </span>
      {typeAnnotation && (
        <span
          style={{
            fontSize: 12,
            color: '#8878b8',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          : {typeAnnotation}
        </span>
      )}
    </div>
  )
}

// ─── Card Node (action, val, def) ──────────────────────────────

function CardNode({
  id,
  color,
  kindLabel,
  name,
  params,
  body,
  roleBadge,
}: {
  id: string
  color: string
  kindLabel: string
  name: string
  params?: string
  body?: string
  roleBadge?: { label: string; color: string } | null
}) {
  const { isSelected, handleClick } = useNodeSelection(id)

  return (
    <div
      onClick={handleClick}
      style={{
        background: '#14102a',
        border: `2px solid ${isSelected ? color : '#2a1f4e'}`,
        borderRadius: 12,
        minWidth: 180,
        boxShadow: isSelected
          ? `0 0 16px ${color}33, 0 4px 20px rgba(0,0,0,0.4)`
          : '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        cursor: 'pointer',
      }}
    >
      <NodeHandles />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: `linear-gradient(135deg, ${color}18, ${color}08)`,
          borderBottom: '1px solid #2a1f4e',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color,
            background: color + '22',
            padding: '2px 8px',
            borderRadius: 5,
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}
        >
          {kindLabel}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#e4e4f0',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {name || 'unnamed'}
        </span>
        {params && (
          <span
            style={{
              fontSize: 12,
              color: '#8878b8',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            ({params})
          </span>
        )}
        {roleBadge && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: roleBadge.color,
              background: roleBadge.color + '18',
              border: `1px solid ${roleBadge.color}33`,
              padding: '1px 6px',
              borderRadius: 4,
              letterSpacing: '0.05em',
              fontFamily: "'JetBrains Mono', monospace",
              marginLeft: 'auto',
            }}
          >
            {roleBadge.label}
          </span>
        )}
      </div>

      {/* Body */}
      {body && (
        <div
          style={{
            padding: '8px 14px',
            fontSize: 12,
            color: '#b0a8d0',
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 120,
            overflow: 'auto',
          }}
        >
          {body}
        </div>
      )}
    </div>
  )
}

// ─── Shield Node (invariant) ───────────────────────────────────

function ShieldNode({
  id,
  name,
  body,
}: {
  id: string
  name: string
  body?: string
}) {
  const { isSelected, handleClick } = useNodeSelection(id)
  const color = COLORS.invariant

  return (
    <div
      onClick={handleClick}
      style={{
        background: '#14102a',
        border: `2px solid ${isSelected ? color : '#2a1f4e'}`,
        borderRadius: 12,
        minWidth: 180,
        maxWidth: 320,
        boxShadow: isSelected
          ? `0 0 16px ${color}33, 0 4px 20px rgba(0,0,0,0.4)`
          : '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <NodeHandles />

      {/* Header with shield icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: `linear-gradient(135deg, ${color}18, ${color}08)`,
          borderBottom: '1px solid #2a1f4e',
        }}
      >
        <span style={{ fontSize: 14 }}>{'\u{1F6E1}'}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color,
            background: color + '22',
            padding: '2px 8px',
            borderRadius: 5,
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          INV
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#e4e4f0',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {name || 'unnamed'}
        </span>
      </div>

      {/* Body */}
      {body && (
        <div
          style={{
            padding: '8px 14px',
            fontSize: 12,
            color: '#b0a8d0',
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {body}
        </div>
      )}
    </div>
  )
}

// ─── Exported Node Components ──────────────────────────────────

function StateVarNodeInner({ data, id }: NodeProps) {
  const d = data as unknown as DeclNodeData
  return (
    <PillNode
      id={id}
      color={COLORS.var}
      kindLabel="var"
      name={d.name}
      typeAnnotation={d.type}
    />
  )
}

function ConstNodeInner({ data, id }: NodeProps) {
  const d = data as unknown as DeclNodeData
  return (
    <PillNode
      id={id}
      color={COLORS.const}
      kindLabel="const"
      name={d.name}
      typeAnnotation={d.type}
    />
  )
}

function TypeNodeInner({ data, id }: NodeProps) {
  const d = data as unknown as DeclNodeData
  return (
    <PillNode
      id={id}
      color={COLORS.type}
      kindLabel="type"
      name={d.name}
      typeAnnotation={d.body}
    />
  )
}

function ActionNodeInner({ data, id }: NodeProps) {
  const d = data as unknown as DeclNodeData
  const actionColor = d.role === 'init' ? COLORS.actionInit : COLORS.actionStep
  const roleBadge = d.role ? ROLE_BADGES[d.role] : null

  return (
    <CardNode
      id={id}
      color={actionColor}
      kindLabel="action"
      name={d.name}
      params={d.params}
      body={d.body}
      roleBadge={roleBadge}
    />
  )
}

function ValNodeInner({ data, id }: NodeProps) {
  const d = data as unknown as DeclNodeData
  // If it has an invariant role, render as shield
  if (d.role === 'invariant') {
    return <ShieldNode id={id} name={d.name} body={d.body} />
  }

  return (
    <CardNode
      id={id}
      color={COLORS.val}
      kindLabel="val"
      name={d.name}
      body={d.body}
    />
  )
}

function DefNodeInner({ data, id }: NodeProps) {
  const d = data as unknown as DeclNodeData
  return (
    <CardNode
      id={id}
      color={COLORS.def}
      kindLabel="def"
      name={d.name}
      params={d.params}
      body={d.body}
    />
  )
}

// ─── Role Group Node (visual container) ────────────────────────

const ROLE_GROUP_COLORS: Record<string, string> = {
  state: '#60a5fa',
  init: '#4ade80',
  actions: '#a78bfa',
  step: '#fb923c',
  invariant: '#facc15',
}

const ROLE_TOOLTIPS: Record<string, string> = {
  state: 'State variables define the system\'s current state \u2014 mutable values that change over time.',
  init: 'Runs once to set up the initial state before any steps execute.',
  actions: 'Helper actions that modify state. Composed together via the step action.',
  step: 'Runs repeatedly during simulation. Each step non-deterministically picks one action to execute. Invariants are checked after each step.',
  invariant: 'Properties that must hold after every step. If violated, a counterexample trace is reported.',
}

function InfoTooltip({ text, color }: { text: string; color: string }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 250)
  }, [])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setVisible(false)
  }, [])

  return (
    <span
      onMouseEnter={show}
      onMouseLeave={hide}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 14,
        height: 14,
        borderRadius: '50%',
        fontSize: 9,
        fontWeight: 700,
        color: color + '66',
        cursor: 'default',
        pointerEvents: 'auto',
        flexShrink: 0,
      }}
    >
      ?
      {visible && (
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1430',
            border: '1px solid #2a1f4e',
            borderRadius: 8,
            padding: '8px 12px',
            width: 300,
            fontSize: 11,
            fontWeight: 400,
            lineHeight: 1.5,
            color: '#b0a8d0',
            fontFamily: "'Inter', system-ui, sans-serif",
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 100,
            pointerEvents: 'none',
            whiteSpace: 'normal',
          }}
        >
          {text}
        </div>
      )}
    </span>
  )
}

function RoleGroupNodeInner({ id, data }: NodeProps) {
  const d = data as unknown as RoleGroupData
  const color = ROLE_GROUP_COLORS[d.role] || '#7c5cfc'
  const addNodeToGroup = useAppStore((s) => s.addNodeToGroup)

  const handleAdd = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      addNodeToGroup(id)
    },
    [id, addNodeToGroup]
  )

  return (
    <div
      style={{
        background: `${color}06`,
        border: `2px dashed ${color}44`,
        borderRadius: 16,
        width: '100%',
        height: '100%',
        padding: '8px 12px 12px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Connection handles on all four sides */}
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color,
            background: color + '18',
            border: `1px solid ${color}33`,
            padding: '2px 8px',
            borderRadius: 4,
            letterSpacing: '0.08em',
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase',
          }}
        >
          {d.label}
        </span>
        {ROLE_TOOLTIPS[d.role] && (
          <InfoTooltip text={ROLE_TOOLTIPS[d.role]} color={color} />
        )}
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={handleAdd}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          width: '100%',
          padding: '6px 0',
          background: `${color}10`,
          border: `1px dashed ${color}44`,
          borderRadius: 8,
          color: `${color}99`,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${color}22`
          e.currentTarget.style.color = color
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `${color}10`
          e.currentTarget.style.color = `${color}99`
        }}
      >
        + {d.role === 'state' ? 'var' : d.role}
      </button>
    </div>
  )
}

// ─── Memoized exports ──────────────────────────────────────────

export const StateVarNode = memo(StateVarNodeInner)
export const ConstNode = memo(ConstNodeInner)
export const TypeNode = memo(TypeNodeInner)
export const ActionNode = memo(ActionNodeInner)
export const ValNode = memo(ValNodeInner)
export const DefNode = memo(DefNodeInner)
export const RoleGroupNode = memo(RoleGroupNodeInner)
