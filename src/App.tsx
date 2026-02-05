import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReactFlowProvider } from '@xyflow/react'
import WhiteboardCanvas from './components/Canvas/WhiteboardCanvas'
import Toolbar from './components/Panels/Toolbar'
import PropertyPanel from './components/Panels/PropertyPanel'
import CodePreview from './components/Panels/CodePreview'
import ExecutionPanel, { type ExecResult, RunResultModal } from './components/Panels/ExecutionPanel'
import { useAppStore } from './model/store'

export default function App() {
  const undo = useAppStore((s) => s.undo)
  const redo = useAppStore((s) => s.redo)
  const panelWidth = useAppStore((s) => s.panelWidth)
  const setPanelWidth = useAppStore((s) => s.setPanelWidth)
  const [showExec, setShowExec] = useState(false)
  const [runResult, setRunResult] = useState<ExecResult | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA'
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
    },
    [undo, redo]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <ReactFlowProvider>
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          overflow: 'hidden',
          background: '#0c0a14',
        }}
      >
        {/* Main canvas area */}
        <div style={{ flex: 1, position: 'relative' }}>
          <WhiteboardCanvas />
          <Toolbar showExec={showExec} onToggleExec={() => setShowExec((v) => !v)} />
          <CodePreview />
          {showExec && (
            <ExecutionPanel
              panelWidth={panelWidth}
              onClose={() => setShowExec(false)}
              onRunResult={setRunResult}
            />
          )}
          {/* Title */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #7c5cfc, #5a3fd4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: 'white',
                boxShadow: '0 2px 8px rgba(124,92,252,0.3)',
              }}
            >
              Q
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#e4e4f0',
                letterSpacing: '0.02em',
              }}
            >
              Quint Whiteboard
            </span>
          </div>
        </div>

        {/* Property panel */}
        <PropertyPanel width={panelWidth} onWidthChange={setPanelWidth} />
      </div>

      {/* Run results modal */}
      {runResult && createPortal(
        <RunResultModal result={runResult} onClose={() => setRunResult(null)} />,
        document.body
      )}
    </ReactFlowProvider>
  )
}
