import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../model/store'
import type { DeclKind, VisualDeclaration } from '../../model/spec'

const DECL_COLORS: Record<DeclKind, string> = {
  var: '#60a5fa',
  const: '#facc15',
  val: '#4ade80',
  def: '#a78bfa',
  action: '#fb923c',
  type: '#f472b6',
  assume: '#94a3b8',
}

export default function PropertyPanel({
  width,
  onWidthChange,
}: {
  width: number
  onWidthChange: (w: number) => void
}) {
  const selectedNodeId = useAppStore((s) => s.selectedNodeId)
  const nodes = useAppStore((s) => s.nodes)
  const updateDeclNode = useAppStore((s) => s.updateDeclNode)
  const deleteDeclNode = useAppStore((s) => s.deleteDeclNode)

  if (!selectedNodeId) {
    return (
      <PanelShell width={width} onWidthChange={onWidthChange}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 12,
            color: '#5a4d80',
          }}
        >
          <div style={{ fontSize: 32 }}>{'\u2B1B'}</div>
          <div style={{ fontSize: 13 }}>Select a node to edit</div>
          <div style={{ fontSize: 11, color: '#453a6a' }}>
            Use the toolbar to add declarations
          </div>
        </div>
      </PanelShell>
    )
  }

  const node = nodes.find((n) => n.id === selectedNodeId)
  if (!node) return null

  const decl = node.data as VisualDeclaration

  return (
    <PanelShell width={width} onWidthChange={onWidthChange}>
      <DeclEditor
        key={selectedNodeId}
        decl={decl}
        onUpdate={(updates) => updateDeclNode(selectedNodeId, updates)}
        onDelete={() => deleteDeclNode(selectedNodeId)}
      />
    </PanelShell>
  )
}

function DeclEditor({
  decl,
  onUpdate,
  onDelete,
}: {
  decl: VisualDeclaration
  onUpdate: (u: Partial<VisualDeclaration>) => void
  onDelete: () => void
}) {
  const color = DECL_COLORS[decl.kind]
  const { status, errorMsg, check, dismiss } = useSyntaxCheck()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            background: color + '22',
            color: color,
            padding: '3px 10px',
            borderRadius: 5,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: 'uppercase',
          }}
        >
          {decl.kind}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <SmallButton onClick={onDelete} title="Delete" danger>
            {'\u2715'}
          </SmallButton>
        </div>
      </div>

      <div>
        <Label>Name</Label>
        <TextInput
          value={decl.name}
          onChange={(v) => onUpdate({ name: v })}
          placeholder="identifier"
          mono
        />
      </div>

      {(decl.kind === 'action' || decl.kind === 'val') && (
        <div>
          <Label>State Machine Role</Label>
          <div style={{ display: 'flex', gap: 4 }}>
            {([undefined, 'init', 'step', 'invariant'] as const).map((role) => {
              const isActive = decl.role === role
              const roleColors: Record<string, string> = {
                init: '#4ade80',
                step: '#fb923c',
                invariant: '#facc15',
              }
              const c = role ? roleColors[role] : '#8878b8'
              return (
                <button
                  key={role ?? 'none'}
                  onClick={() => onUpdate({ role })}
                  style={{
                    background: isActive ? c + '22' : 'transparent',
                    color: isActive ? c : '#5a4d80',
                    border: `1px solid ${isActive ? c + '44' : '#2a1f4e'}`,
                    borderRadius: 5,
                    padding: '4px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: 'all 0.15s',
                  }}
                >
                  {role ?? 'none'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {(decl.kind === 'val' || decl.kind === 'def') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#8878b8',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!decl.pure}
              onChange={(e) => onUpdate({ pure: e.target.checked })}
              style={{ accentColor: '#7c5cfc' }}
            />
            pure (no state dependency)
          </label>
        </div>
      )}

      {(decl.kind === 'var' || decl.kind === 'const') && (
        <div>
          <Label>Type</Label>
          <TextInput
            value={decl.type}
            onChange={(v) => onUpdate({ type: v })}
            placeholder="int"
            mono
          />
        </div>
      )}

      {(decl.kind === 'def' || decl.kind === 'action') && (
        <div>
          <Label>Parameters</Label>
          <TextInput
            value={decl.params}
            onChange={(v) => onUpdate({ params: v })}
            placeholder="x: int, y: str"
            mono
          />
        </div>
      )}

      {(decl.kind === 'def' || decl.kind === 'action') && (
        <div>
          <Label>Return Type (optional)</Label>
          <TextInput
            value={decl.type}
            onChange={(v) => onUpdate({ type: v })}
            placeholder="bool"
            mono
          />
        </div>
      )}

      {decl.kind !== 'var' && decl.kind !== 'const' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Label style={{ marginBottom: 0 }}>Body</Label>
            <CheckButton status={status} onClick={check} />
            {status === 'ok' && (
              <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>{'\u2713'}</span>
            )}
            {status === 'error' && (
              <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>{'\u2717'}</span>
            )}
          </div>
          <TextArea
            value={decl.body}
            onChange={(v) => { onUpdate({ body: v }); dismiss() }}
            placeholder="expression..."
          />
          {status === 'error' && errorMsg && (
            <div
              style={{
                marginTop: 6,
                padding: '6px 10px',
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.15)',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: '#f0a8a8',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 120,
                overflow: 'auto',
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <button
          onClick={onDelete}
          style={{
            width: '100%',
            background: 'rgba(248,113,113,0.1)',
            color: '#f87171',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 7,
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(248,113,113,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(248,113,113,0.1)'
          }}
        >
          Delete Node
        </button>
      </div>
    </div>
  )
}

async function quintApi(endpoint: string, body: object): Promise<{ ok: boolean; output: string }> {
  const res = await fetch(`/api/quint/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

function useSyntaxCheck() {
  const getQuintCode = useAppStore((s) => s.getQuintCode)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const check = useCallback(async () => {
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await quintApi('typecheck', { code: getQuintCode() })
      if (result.ok) {
        setStatus('ok')
      } else {
        setStatus('error')
        setErrorMsg(result.output)
      }
    } catch (e) {
      setStatus('error')
      setErrorMsg(String(e))
    }
  }, [getQuintCode])

  const dismiss = useCallback(() => { setStatus('idle'); setErrorMsg('') }, [])

  return { status, errorMsg, check, dismiss }
}

function CheckButton({ status, onClick }: { status: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={status === 'loading'}
      style={{
        background: 'linear-gradient(135deg, #7c5cfc, #5a3fd4)',
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        padding: '2px 10px',
        fontSize: 10,
        fontWeight: 700,
        cursor: status === 'loading' ? 'wait' : 'pointer',
        fontFamily: "'JetBrains Mono', monospace",
        transition: 'all 0.15s',
        opacity: status === 'loading' ? 0.6 : 1,
        boxShadow: '0 1px 4px rgba(124,92,252,0.3)',
      }}
      onMouseEnter={(e) => {
        if (status !== 'loading') e.currentTarget.style.opacity = '0.85'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = status === 'loading' ? '0.6' : '1'
      }}
    >
      {status === 'loading' ? '...' : 'Check'}
    </button>
  )
}

function PanelShell({
  children,
  width,
  onWidthChange,
}: {
  children: React.ReactNode
  width: number
  onWidthChange: (w: number) => void
}) {
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startW.current = width
    },
    [width]
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      const newWidth = Math.min(800, Math.max(260, startW.current + delta))
      onWidthChange(newWidth)
    }
    const onMouseUp = () => {
      dragging.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onWidthChange])

  return (
    <div
      style={{
        width,
        height: '100%',
        background: '#110d1f',
        borderLeft: '1px solid #2a1f4e',
        display: 'flex',
        flexDirection: 'row',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: 6,
          cursor: 'col-resize',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 2,
            height: 40,
            borderRadius: 1,
            background: '#2a1f4e',
            transition: 'background 0.15s',
          }}
        />
      </div>

      {/* Panel content */}
      <div
        style={{
          flex: 1,
          padding: '16px 16px 16px 10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#8878b8',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 16,
          }}
        >
          Properties
        </div>
        {children}
      </div>
    </div>
  )
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: '#8878b8',
        marginBottom: 4,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        background: '#18122e',
        border: '1px solid #2a1f4e',
        borderRadius: 6,
        padding: '8px 10px',
        color: '#e4e4f0',
        fontSize: 13,
        fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
        outline: 'none',
        transition: 'border-color 0.15s',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#7c5cfc'
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#2a1f4e'
      }}
    />
  )
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={8}
      style={{
        width: '100%',
        background: '#18122e',
        border: '1px solid #2a1f4e',
        borderRadius: 6,
        padding: '8px 10px',
        color: '#e4e4f0',
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        outline: 'none',
        resize: 'vertical',
        lineHeight: 1.5,
        transition: 'border-color 0.15s',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#7c5cfc'
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#2a1f4e'
      }}
    />
  )
}

function SmallButton({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: danger ? 'rgba(248,113,113,0.1)' : 'rgba(124,92,252,0.08)',
        color: danger ? '#f87171' : '#8878b8',
        border: 'none',
        borderRadius: 5,
        padding: '4px 8px',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? 'rgba(248,113,113,0.2)'
          : 'rgba(124,92,252,0.15)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = danger
          ? 'rgba(248,113,113,0.1)'
          : 'rgba(124,92,252,0.08)'
      }}
    >
      {children}
    </button>
  )
}
