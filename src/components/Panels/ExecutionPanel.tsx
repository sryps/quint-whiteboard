import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../../model/store'

type TabId = 'typecheck' | 'eval' | 'run'

export interface ExecResult {
  ok: boolean
  output: string
}

async function quintApi(endpoint: string, body: object): Promise<ExecResult> {
  const res = await fetch(`/api/quint/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export default function ExecutionPanel({
  panelWidth,
  onClose,
  onRunResult,
}: {
  panelWidth: number
  onClose: () => void
  onRunResult: (result: ExecResult) => void
}) {
  const getQuintCode = useAppStore((s) => s.getQuintCode)
  const moduleName = useAppStore((s) => s.moduleName)
  const [tab, setTab] = useState<TabId>('run')
  const [output, setOutput] = useState<ExecResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [evalExpr, setEvalExpr] = useState('')
  const nodes = useAppStore((s) => s.nodes)
  const [maxSamples, setMaxSamples] = useState(100)

  const handleTypecheck = useCallback(async () => {
    setLoading(true)
    setOutput(null)
    try {
      const result = await quintApi('typecheck', { code: getQuintCode() })
      setOutput(result)
    } catch (e) {
      setOutput({ ok: false, output: String(e) })
    }
    setLoading(false)
  }, [getQuintCode])

  const handleEval = useCallback(async () => {
    if (!evalExpr.trim()) return
    setLoading(true)
    setOutput(null)
    try {
      const result = await quintApi('eval', {
        code: getQuintCode(),
        expr: evalExpr,
        module: moduleName || 'MyModule',
      })
      setOutput(result)
    } catch (e) {
      setOutput({ ok: false, output: String(e) })
    }
    setLoading(false)
  }, [getQuintCode, evalExpr, moduleName])

  const handleRun = useCallback(async () => {
    setLoading(true)
    setOutput(null)
    try {
      // Auto-detect invariant names from nodes with role='invariant'
      const invNames = nodes
        .filter((n) => n.type !== 'role-group' && (n.data as any)?.role === 'invariant' && (n.data as any)?.name)
        .map((n) => (n.data as any).name)
      const invariant = invNames.length > 0 ? invNames.join(' and ') : 'true'

      const result = await quintApi('run', {
        code: getQuintCode(),
        init: 'init',
        step: 'step',
        invariant,
        maxSteps: 20,
        maxSamples,
      })
      setOutput(result)
      onRunResult(result)
      onClose() // Minimize the panel after run completes
    } catch (e) {
      const err = { ok: false, output: String(e) }
      setOutput(err)
      onRunResult(err)
      onClose() // Minimize even on error, modal will show the error
    }
    setLoading(false)
  }, [getQuintCode, nodes, maxSamples, onClose, onRunResult])

  return (
    <div
      style={{
        position: 'absolute',
        top: 64,
        right: panelWidth + 16,
        width: 360,
        maxHeight: 'calc(100vh - 80px)',
        background: '#110d1f',
        border: '1px solid #2a1f4e',
        borderRadius: 12,
        zIndex: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #2a1f4e',
          flexShrink: 0,
        }}
      >
        {[
          { id: 'run' as TabId, label: 'Run' },
          { id: 'typecheck' as TabId, label: 'Typecheck' },
          { id: 'eval' as TabId, label: 'Eval' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id)
              setOutput(null)
            }}
            style={{
              flex: 1,
              background: tab === t.id ? 'rgba(124,92,252,0.1)' : 'transparent',
              color: tab === t.id ? '#9d84fd' : '#8878b8',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #7c5cfc' : '2px solid transparent',
              padding: '10px 0',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        style={{
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 1,
          overflow: 'auto',
        }}
      >
        {tab === 'run' && (
          <>
            <div style={{ fontSize: 11, color: '#8878b8' }}>Simulate the state machine</div>
            <ConfigRow
              label="Max samples"
              value={String(maxSamples)}
              onChange={(v) => setMaxSamples(parseInt(v) || 100)}
            />
            <ActionButton onClick={handleRun} loading={loading} label="Run Simulation" accent />
          </>
        )}

        {tab === 'typecheck' && (
          <>
            <div style={{ fontSize: 11, color: '#8878b8' }}>
              Check your spec for type errors
            </div>
            <ActionButton onClick={handleTypecheck} loading={loading} label="Typecheck" />
          </>
        )}

        {tab === 'eval' && (
          <>
            <div style={{ fontSize: 11, color: '#8878b8' }}>
              Evaluate an expression in {moduleName || 'MyModule'}
            </div>
            <input
              type="text"
              value={evalExpr}
              onChange={(e) => setEvalExpr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEval()
              }}
              placeholder="e.g. addInt(2, 3)"
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
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#7c5cfc'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#2a1f4e'
              }}
            />
            <ActionButton onClick={handleEval} loading={loading} label="Evaluate" />
          </>
        )}

        {/* Output summary – click to re-open modal */}
        {output && (
          <button
            onClick={() => onRunResult(output)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: output.ok
                ? 'rgba(74,222,128,0.06)'
                : 'rgba(248,113,113,0.06)',
              border: `1px solid ${output.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
              borderRadius: 8,
              padding: '8px 12px',
              marginTop: 4,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: output.ok ? '#4ade80' : '#f87171',
              }}
            >
              {output.ok ? '\u2713' : '\u2717'}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: output.ok ? '#4ade80' : '#f87171',
                flex: 1,
              }}
            >
              {output.ok ? 'Success' : 'Invariant Violated'}
            </span>
            <span style={{ fontSize: 10, color: '#8878b8' }}>
              Click to view
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

/** Parse quint run output into structured sections */
function parseRunOutput(raw: string): { summary: string; trace: string; rest: string } {
  const lines = raw.split('\n')
  const summaryLines: string[] = []
  const traceLines: string[] = []
  const restLines: string[] = []

  let section: 'summary' | 'trace' | 'rest' = 'summary'
  for (const line of lines) {
    if (/^\[State \d+\]/.test(line) || /^State \d+:/.test(line) || /^\s*\{/.test(line)) {
      section = 'trace'
    } else if (section === 'trace' && line.trim() === '' && traceLines.length > 0) {
      // blank line after trace content may signal end of trace
      const nextIdx = lines.indexOf(line, lines.indexOf(traceLines[traceLines.length - 1]) + 1)
      const nextLine = lines[nextIdx + 1]
      if (nextLine && !/^\s*\{/.test(nextLine) && !/^\[State/.test(nextLine) && !/^State \d+/.test(nextLine)) {
        section = 'rest'
      }
    }

    if (section === 'summary') summaryLines.push(line)
    else if (section === 'trace') traceLines.push(line)
    else restLines.push(line)
  }

  return {
    summary: summaryLines.join('\n').trim(),
    trace: traceLines.join('\n').trim(),
    rest: restLines.join('\n').trim(),
  }
}

export function RunResultModal({ result, onClose }: { result: ExecResult; onClose: () => void }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const parsed = parseRunOutput(result.output)
  const isViolation = !result.ok && /invariant|violated/i.test(result.output)
  const headerColor = result.ok ? '#4ade80' : '#f87171'
  const headerBg = result.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)'
  const headerLabel = result.ok
    ? 'Simulation Passed'
    : isViolation
      ? 'Invariant Violated'
      : 'Simulation Error'

  // Extract invariant name if present
  const invMatch = result.output.match(/(?:invariant|violation of)\s+(\w+)/i)
  const invName = invMatch?.[1]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#13101f',
          border: '1px solid #2a1f4e',
          borderRadius: 16,
          width: 'min(720px, 90vw)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 20px',
            background: headerBg,
            borderBottom: `1px solid ${headerColor}33`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 22 }}>
            {result.ok ? '\u2713' : '\u2717'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: headerColor }}>
              {headerLabel}
            </div>
            {invName && !result.ok && (
              <div style={{ fontSize: 12, color: '#e4e4f0', marginTop: 2, opacity: 0.8 }}>
                Invariant <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#f0a8a8', fontWeight: 600 }}>{invName}</span> was violated during simulation
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#8878b8',
              fontSize: 13,
              padding: '4px 12px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            ESC
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Summary section */}
          {parsed.summary && (
            <OutputSection title="Output" content={parsed.summary} color={headerColor} />
          )}

          {/* State trace */}
          {parsed.trace && (
            <OutputSection title="State Trace" content={parsed.trace} color="#a78bfa" />
          )}

          {/* Additional info */}
          {parsed.rest && (
            <OutputSection title="Details" content={parsed.rest} color="#8878b8" />
          )}

          {/* Fallback: if parsing didn't split anything useful, show full output */}
          {!parsed.summary && !parsed.trace && !parsed.rest && (
            <OutputSection title="Output" content={result.output} color={headerColor} />
          )}
        </div>
      </div>
    </div>
  )
}

function OutputSection({ title, content, color }: { title: string; content: string; color: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1,
          color,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <pre
        style={{
          margin: 0,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          lineHeight: 1.6,
          color: '#e4e4f0',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid #2a1f4e',
          borderRadius: 10,
          padding: 14,
          overflow: 'auto',
        }}
      >
        {content}
      </pre>
    </div>
  )
}

function ActionButton({
  onClick,
  loading,
  label,
  accent,
}: {
  onClick: () => void
  loading: boolean
  label: string
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%',
        background: accent
          ? 'linear-gradient(135deg, #7c5cfc, #5a3fd4)'
          : 'rgba(124,92,252,0.15)',
        color: accent ? '#fff' : '#9d84fd',
        border: accent ? 'none' : '1px solid rgba(124,92,252,0.3)',
        borderRadius: 7,
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 600,
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1,
        transition: 'all 0.15s',
      }}
    >
      {loading ? 'Running...' : label}
    </button>
  )
}

function ConfigRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#8878b8', minWidth: 80 }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          background: '#18122e',
          border: '1px solid #2a1f4e',
          borderRadius: 5,
          padding: '5px 8px',
          color: '#e4e4f0',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#7c5cfc'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#2a1f4e'
        }}
      />
    </div>
  )
}
