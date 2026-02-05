import { useMemo, useCallback } from 'react'
import { useAppStore } from '../../model/store'

export default function CodePreview() {
  const showCodePreview = useAppStore((s) => s.showCodePreview)
  const getQuintCode = useAppStore((s) => s.getQuintCode)
  const nodes = useAppStore((s) => s.nodes)
  const moduleName = useAppStore((s) => s.moduleName)

  const code = useMemo(() => getQuintCode(), [nodes, moduleName, getQuintCode])

  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'spec.qnt'
    a.click()
    URL.revokeObjectURL(url)
  }, [code])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
  }, [code])

  if (!showCodePreview) return null

  const hasCode = nodes.length > 0

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(700px, 90vw)',
        maxHeight: 300,
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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          borderBottom: '1px solid #2a1f4e',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#8878b8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Generated Quint
          </span>
          {hasCode && (
            <span
              style={{
                fontSize: 10,
                color: '#4ade80',
                background: 'rgba(74,222,128,0.1)',
                padding: '2px 8px',
                borderRadius: 10,
                fontWeight: 500,
              }}
            >
              .qnt
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PreviewButton onClick={handleCopy} label="Copy" />
          <PreviewButton onClick={handleDownload} label="Download" accent />
        </div>
      </div>

      {/* Code */}
      <div style={{ overflow: 'auto', padding: '12px 16px', flex: 1 }}>
        {hasCode ? (
          <pre
            style={{
              margin: 0,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              lineHeight: 1.6,
              color: '#e4e4f0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <SyntaxHighlight code={code} />
          </pre>
        ) : (
          <div
            style={{
              color: '#5a4d80',
              fontSize: 12,
              fontStyle: 'italic',
              textAlign: 'center',
              padding: 20,
            }}
          >
            Add nodes to see generated Quint code
          </div>
        )}
      </div>
    </div>
  )
}

function SyntaxHighlight({ code }: { code: string }) {
  const highlighted = code.split('\n').map((line, i) => {
    const parts: React.ReactNode[] = []
    let rest = line

    // Comments
    const commentIdx = rest.indexOf('//')
    let comment = ''
    if (commentIdx !== -1) {
      comment = rest.slice(commentIdx)
      rest = rest.slice(0, commentIdx)
    }

    // Keywords
    const kwRegex =
      /\b(module|var|const|val|def|action|type|assume|pure|nondet|temporal|import|from|export|if|else|all|any|not|and|or|iff|implies|Set|List|Map|Rec|Tup|true|false|Int|Nat|Bool|Str)\b/g
    let match: RegExpExecArray | null
    let lastIdx = 0

    while ((match = kwRegex.exec(rest)) !== null) {
      if (match.index > lastIdx) {
        parts.push(rest.slice(lastIdx, match.index))
      }
      const kw = match[1]
      const isType = /^[A-Z]/.test(kw) || ['int', 'str', 'bool'].includes(kw)
      const isKeyword = [
        'module',
        'var',
        'const',
        'val',
        'def',
        'action',
        'type',
        'assume',
        'pure',
        'nondet',
        'temporal',
        'import',
        'from',
        'export',
        'if',
        'else',
      ].includes(kw)
      const isOperator = ['all', 'any', 'not', 'and', 'or', 'iff', 'implies'].includes(kw)
      const isBool = kw === 'true' || kw === 'false'

      let color = '#e4e4f0'
      if (isKeyword) color = '#c084fc'
      else if (isType) color = '#60a5fa'
      else if (isOperator) color = '#fb923c'
      else if (isBool) color = '#4ade80'

      parts.push(
        <span key={`${i}-${match.index}`} style={{ color, fontWeight: isKeyword ? 600 : 400 }}>
          {kw}
        </span>
      )
      lastIdx = match.index + match[0].length
    }

    if (lastIdx < rest.length) {
      parts.push(rest.slice(lastIdx))
    }

    if (comment) {
      parts.push(
        <span key={`${i}-comment`} style={{ color: '#5a4d80', fontStyle: 'italic' }}>
          {comment}
        </span>
      )
    }

    return (
      <span key={i}>
        {parts}
        {'\n'}
      </span>
    )
  })

  return <>{highlighted}</>
}

function PreviewButton({
  label,
  onClick,
  accent,
}: {
  label: string
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: accent ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.05)',
        color: accent ? '#9d84fd' : '#8878b8',
        border: accent ? '1px solid rgba(124,92,252,0.3)' : '1px solid transparent',
        borderRadius: 5,
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = accent
          ? 'rgba(124,92,252,0.25)'
          : 'rgba(255,255,255,0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = accent
          ? 'rgba(124,92,252,0.15)'
          : 'rgba(255,255,255,0.05)'
      }}
    >
      {label}
    </button>
  )
}
