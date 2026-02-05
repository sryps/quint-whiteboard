import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import { useAppStore, type AnyNodeData } from '../../model/store'
import type { DeclNodeData } from '../../model/spec'
import {
  StateVarNode,
  ConstNode,
  TypeNode,
  ActionNode,
  ValNode,
  DefNode,
  RoleGroupNode,
} from '../Nodes/DeclNodes'
import type { Node } from '@xyflow/react'

const nodeTypes = {
  'state-var': StateVarNode,
  const: ConstNode,
  type: TypeNode,
  action: ActionNode,
  val: ValNode,
  def: DefNode,
  'role-group': RoleGroupNode,
}

export default function WhiteboardCanvas() {
  const nodes = useAppStore((s) => s.nodes)
  const edges = useAppStore((s) => s.edges)
  const onNodesChange = useAppStore((s) => s.onNodesChange)
  const onEdgesChange = useAppStore((s) => s.onEdgesChange)
  const onConnect = useAppStore((s) => s.onConnect)
  const addDeclNode = useAppStore((s) => s.addDeclNode)
  const setSelectedNode = useAppStore((s) => s.setSelectedNode)

  const reactFlowInstance = useRef<ReactFlowInstance<Node<AnyNodeData>> | null>(null)

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  // Sync ReactFlow's selection with our store
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      if (selectedNodes.length === 1) {
        setSelectedNode(selectedNodes[0].id)
      } else if (selectedNodes.length === 0) {
        setSelectedNode(null)
      }
      // For multi-selection, keep the first one for property panel
    },
    [setSelectedNode]
  )

  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!reactFlowInstance.current) return
      const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect()
      if (!bounds) return

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      addDeclNode('var', position.x, position.y)
    },
    [addDeclNode]
  )

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          reactFlowInstance.current = instance as ReactFlowInstance<Node<AnyNodeData>>
          // If nodes were restored from persistence, center the view on them
          if (nodes.length > 0) {
            setTimeout(() => instance.fitView({ padding: 0.15, duration: 200 }), 50)
          }
        }}
        onPaneClick={onPaneClick}
        onDoubleClick={onDoubleClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView={false}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0e0a1a' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#2a1f4e"
        />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => {
            const kind = (node.data as DeclNodeData)?.kind
            const colorMap: Record<string, string> = {
              var: '#60a5fa',
              const: '#facc15',
              val: '#4ade80',
              def: '#a78bfa',
              action: '#fb923c',
              type: '#f472b6',
            }
            return colorMap[kind] || '#7c5cfc'
          }}
          maskColor="rgba(14, 10, 26, 0.8)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  )
}
