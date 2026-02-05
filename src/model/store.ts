import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'
import { nanoid } from 'nanoid'
import {
  type VisualDeclaration,
  type DeclKind,
  type DeclNodeData,
  type RoleGroupData,
  createDeclaration,
  createStateMachineDecls,
  declsToQuint,
} from './spec'

/** Union of all node data types */
export type AnyNodeData = DeclNodeData | RoleGroupData

const GROUP_PADDING = 15
const GROUP_HEADER = 30
const GROUP_BUTTON_AREA = 40
const COLLISION_PAD = 10

/** Recalculate group node dimensions to tightly fit their children */
function resizeGroups(nodes: Node<AnyNodeData>[]): Node<AnyNodeData>[] {
  const groups = nodes.filter((n) => n.type === 'role-group')
  if (groups.length === 0) return nodes

  const groupIds = new Set(groups.map((g) => g.id))
  const childrenByGroup = new Map<string, Node<AnyNodeData>[]>()
  for (const n of nodes) {
    if (n.parentId && groupIds.has(n.parentId)) {
      const list = childrenByGroup.get(n.parentId) || []
      list.push(n)
      childrenByGroup.set(n.parentId, list)
    }
  }

  return nodes.map((node) => {
    if (node.type !== 'role-group') return node
    const children = childrenByGroup.get(node.id)
    if (!children || children.length === 0) return node

    let maxRight = 0
    let maxBottom = 0
    for (const child of children) {
      const w = child.measured?.width ?? 220
      const h = child.measured?.height ?? 80
      maxRight = Math.max(maxRight, child.position.x + w)
      maxBottom = Math.max(maxBottom, child.position.y + h)
    }

    const newWidth = maxRight + GROUP_PADDING
    const newHeight = maxBottom + GROUP_PADDING + GROUP_BUTTON_AREA

    const oldW = (node.style as Record<string, number>)?.width
    const oldH = (node.style as Record<string, number>)?.height
    if (oldW === newWidth && oldH === newHeight) return node

    return {
      ...node,
      style: { ...node.style, width: newWidth, height: newHeight },
    }
  })
}

/** Stop dragged nodes at the edge of any sibling they collide with */
function resolveCollisions(
  nodes: Node<AnyNodeData>[],
  movedIds: Set<string>
): Node<AnyNodeData>[] {
  if (movedIds.size === 0) return nodes

  // Group node indices by parentId so we only check siblings
  const byParent = new Map<string, number[]>()
  for (let i = 0; i < nodes.length; i++) {
    const key = nodes[i].parentId ?? ''
    const arr = byParent.get(key) || []
    arr.push(i)
    byParent.set(key, arr)
  }

  const out = nodes.slice()
  let didChange = false

  for (const [, idxs] of byParent) {
    if (idxs.length < 2) continue

    for (let pass = 0; pass < 3; pass++) {
      let settled = true

      for (let i = 0; i < idxs.length; i++) {
        for (let j = i + 1; j < idxs.length; j++) {
          const a = out[idxs[i]]
          const b = out[idxs[j]]

          const aIsMoved = movedIds.has(a.id)
          const bIsMoved = movedIds.has(b.id)
          if (!aIsMoved && !bIsMoved) continue

          const aw = (a.measured?.width ?? 200) + COLLISION_PAD
          const ah = (a.measured?.height ?? 80) + COLLISION_PAD
          const bw = (b.measured?.width ?? 200) + COLLISION_PAD
          const bh = (b.measured?.height ?? 80) + COLLISION_PAD

          const ox =
            Math.min(a.position.x + aw, b.position.x + bw) -
            Math.max(a.position.x, b.position.x)
          const oy =
            Math.min(a.position.y + ah, b.position.y + bh) -
            Math.max(a.position.y, b.position.y)

          if (ox <= 0 || oy <= 0) continue

          // Stop the dragged node, the other stays put
          let stopI: number, blockI: number
          if (aIsMoved && !bIsMoved) {
            stopI = idxs[i]
            blockI = idxs[j]
          } else if (bIsMoved && !aIsMoved) {
            stopI = idxs[j]
            blockI = idxs[i]
          } else {
            stopI = idxs[j]
            blockI = idxs[i]
          }

          const blocker = out[blockI]
          const stopped = out[stopI]
          const blockerPadW = (blocker.measured?.width ?? 200) + COLLISION_PAD
          const blockerPadH = (blocker.measured?.height ?? 80) + COLLISION_PAD
          const stoppedPadW = (stopped.measured?.width ?? 200) + COLLISION_PAD
          const stoppedPadH = (stopped.measured?.height ?? 80) + COLLISION_PAD

          const newPos = { ...stopped.position }

          if (ox < oy) {
            if (stopped.position.x >= blocker.position.x) {
              newPos.x = blocker.position.x + blockerPadW
            } else {
              newPos.x = blocker.position.x - stoppedPadW
            }
          } else {
            if (stopped.position.y >= blocker.position.y) {
              newPos.y = blocker.position.y + blockerPadH
            } else {
              newPos.y = blocker.position.y - stoppedPadH
            }
          }

          out[stopI] = { ...stopped, position: newPos }
          settled = false
          didChange = true
        }
      }

      if (settled) break
    }
  }

  return didChange ? out : nodes
}

/** Maps DeclKind to the React Flow node type string */
const KIND_TO_NODE_TYPE: Record<DeclKind, string> = {
  var: 'state-var',
  const: 'const',
  val: 'val',
  def: 'def',
  action: 'action',
  type: 'type',
  assume: 'val', // treat assume like val visually
}

interface HistoryEntry {
  nodes: Node<AnyNodeData>[]
  edges: Edge[]
  moduleName: string
}

export interface AppState {
  // React Flow state
  nodes: Node<AnyNodeData>[]
  edges: Edge[]
  onNodesChange: OnNodesChange<Node<AnyNodeData>>
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect

  // Single module
  moduleName: string
  selectedNodeId: string | null
  showCodePreview: boolean
  panelWidth: number

  // History
  history: HistoryEntry[]
  historyIndex: number

  // Actions
  setModuleName: (name: string) => void
  addDeclNode: (kind: DeclKind, x: number, y: number) => void
  addStateMachineNodes: (x: number, y: number) => void
  addNodeToGroup: (groupId: string) => void
  updateDeclNode: (nodeId: string, updates: Partial<VisualDeclaration>) => void
  deleteDeclNode: (nodeId: string) => void

  setSelectedNode: (id: string | null) => void
  toggleCodePreview: () => void
  setPanelWidth: (width: number) => void
  clearCanvas: () => void

  getQuintCode: () => string
  undo: () => void
  redo: () => void
  pushHistory: () => void
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  nodes: [],
  edges: [],
  moduleName: 'MyModule',
  selectedNodeId: null,
  showCodePreview: false,
  panelWidth: 500,

  history: [],
  historyIndex: -1,

  onNodesChange: (changes) => {
    const removals = changes.filter((c) => c.type === 'remove')

    // Collect IDs of nodes whose position actually changed (drag)
    const movedIds = new Set<string>()
    for (const c of changes) {
      if (c.type === 'position' && 'position' in c && c.position) {
        movedIds.add(c.id)
      }
    }

    if (removals.length > 0) {
      get().pushHistory()
      const removedIds = new Set(removals.map((c) => c.id))
      set((state) => {
        let updated = applyNodeChanges(changes, state.nodes)
        updated = resolveCollisions(updated, movedIds)
        return {
          nodes: resizeGroups(updated),
          edges: state.edges.filter(
            (e) => !removedIds.has(e.source) && !removedIds.has(e.target)
          ),
          selectedNodeId:
            state.selectedNodeId && removedIds.has(state.selectedNodeId)
              ? null
              : state.selectedNodeId,
        }
      })
    } else {
      let updated = applyNodeChanges(changes, get().nodes)
      updated = resolveCollisions(updated, movedIds)
      set({ nodes: resizeGroups(updated) })
    }
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) })
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#4a4a7a', strokeWidth: 2 },
        },
        get().edges
      ),
    })
  },

  pushHistory: () => {
    const { nodes, edges, moduleName, history, historyIndex } = get()
    const entry: HistoryEntry = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      moduleName,
    }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(entry)
    if (newHistory.length > 50) newHistory.shift()
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    const entry = history[historyIndex - 1]
    set({
      nodes: entry.nodes,
      edges: entry.edges,
      moduleName: entry.moduleName,
      historyIndex: historyIndex - 1,
    })
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const entry = history[historyIndex + 1]
    set({
      nodes: entry.nodes,
      edges: entry.edges,
      moduleName: entry.moduleName,
      historyIndex: historyIndex + 1,
    })
  },

  setModuleName: (name: string) => set({ moduleName: name }),

  addDeclNode: (kind: DeclKind, x: number, y: number) => {
    const id = nanoid(8)
    const defaults: Record<DeclKind, Partial<VisualDeclaration>> = {
      var: { name: 'myVar', type: 'int' },
      const: { name: 'MY_CONST', type: 'int' },
      val: { name: 'myVal', body: 'true' },
      def: { name: 'myDef', params: '', body: 'true' },
      action: { name: 'myAction', params: '', body: 'true' },
      type: { name: 'MyType', body: 'int' },
      assume: { name: 'myAssumption', body: 'true' },
    }
    const decl = createDeclaration(id, kind, defaults[kind])

    const newNode: Node<AnyNodeData> = {
      id,
      type: KIND_TO_NODE_TYPE[kind],
      position: { x, y },
      data: { ...decl },
    }

    get().pushHistory()
    set((state) => ({
      nodes: [...state.nodes, newNode],
      selectedNodeId: id,
    }))
  },

  addStateMachineNodes: (x: number, y: number) => {
    const decls = createStateMachineDecls(() => nanoid(8))

    // decls: [balances, ADDRESSES, init, deposit, withdraw, step, no_negatives]
    const balancesId = decls[0].id
    const addressesId = decls[1].id
    const initId = decls[2].id
    const depositId = decls[3].id
    const withdrawId = decls[4].id
    const stepId = decls[5].id
    const invId = decls[6].id

    // Group IDs
    const stateGroupId = nanoid(8)
    const initGroupId = nanoid(8)
    const actionsGroupId = nanoid(8)
    const stepGroupId = nanoid(8)
    const invGroupId = nanoid(8)

    // Child positions inside groups (stacked vertically with room for card height)
    const childX = GROUP_PADDING
    const childY1 = GROUP_HEADER + 10
    const childY2 = childY1 + 70   // pill ~50px + small gap

    // Flow layout representing execution:
    // 1. INIT initializes STATE (left to right)
    // 2. STEP reads STATE and calls ACTIONS (center loop)
    // 3. ACTIONS update STATE
    // 4. INVARIANTS check STATE (below)
    //
    //    INIT ──→ STATE ←── ACTIONS
    //               │           ↑
    //               │         STEP
    //               ↓
    //          INVARIANTS

    // Simple grid layout centered on (x, y)
    // Groups are ~280px wide, use 450px spacing between columns
    const col1 = x - 450   // Left (INIT)
    const col2 = x         // Center (STATE, INVARIANTS)
    const col3 = x + 450   // Right (ACTIONS, STEP)

    const row1 = y              // Top (INIT, STATE, ACTIONS)
    const row2 = row1 + 340     // Middle-right (STEP below ACTIONS)
    const row3 = row1 + 350     // Bottom-center (INVARIANTS below STATE)

    // Individual declaration nodes
    const newNodes: Node<AnyNodeData>[] = [
      // INIT - left side, initializes state
      {
        id: initGroupId,
        type: 'role-group',
        position: { x: col1, y: row1 },
        data: { isGroup: true, role: 'init', label: 'INIT' },
        style: { width: 1, height: 1 },
      },
      { id: initId, type: 'action', position: { x: childX, y: childY1 }, data: { ...decls[2] }, parentId: initGroupId },

      // STATE - center, the core state variables
      {
        id: stateGroupId,
        type: 'role-group',
        position: { x: col2, y: row1 },
        data: { isGroup: true, role: 'state', label: 'STATE' },
        style: { width: 1, height: 1 },
      },
      { id: balancesId, type: 'state-var', position: { x: childX, y: childY1 }, data: { ...decls[0] }, parentId: stateGroupId },
      { id: addressesId, type: 'val', position: { x: childX, y: childY2 }, data: { ...decls[1] }, parentId: stateGroupId },

      // ACTIONS - right side top, helper actions that modify state
      {
        id: actionsGroupId,
        type: 'role-group',
        position: { x: col3, y: row1 },
        data: { isGroup: true, role: 'actions', label: 'ACTIONS' },
        style: { width: 1, height: 1 },
      },
      { id: depositId, type: 'action', position: { x: childX, y: childY1 }, data: { ...decls[3] }, parentId: actionsGroupId },
      { id: withdrawId, type: 'action', position: { x: childX, y: childY2 }, data: { ...decls[4] }, parentId: actionsGroupId },

      // STEP - right side below actions, orchestrates the step
      {
        id: stepGroupId,
        type: 'role-group',
        position: { x: col3, y: row2 },
        data: { isGroup: true, role: 'step', label: 'STEP' },
        style: { width: 1, height: 1 },
      },
      { id: stepId, type: 'action', position: { x: childX, y: childY1 }, data: { ...decls[5] }, parentId: stepGroupId },

      // INVARIANTS - bottom center, checks state after each step
      {
        id: invGroupId,
        type: 'role-group',
        position: { x: col2, y: row3 },
        data: { isGroup: true, role: 'invariant', label: 'INVARIANTS' },
        style: { width: 1, height: 1 },
      },
      { id: invId, type: 'val', position: { x: childX, y: childY1 }, data: { ...decls[6] }, parentId: invGroupId },
    ]

    const newEdges: Edge[] = [
      // INIT → STATE (left to right: init's right side to state's left side)
      {
        id: `e-${initGroupId}-${stateGroupId}`,
        source: initGroupId,
        target: stateGroupId,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'smoothstep',
        animated: true,
        label: 'initializes',
        style: { stroke: '#4ade80', strokeWidth: 2 },
        labelStyle: { fill: '#4ade80', fontSize: 10 },
      },
      // STEP → ACTIONS (bottom to top: step's top to actions' bottom)
      {
        id: `e-${stepGroupId}-${actionsGroupId}`,
        source: stepGroupId,
        target: actionsGroupId,
        sourceHandle: 'top',
        targetHandle: 'bottom',
        type: 'smoothstep',
        animated: true,
        label: 'calls',
        style: { stroke: '#a78bfa', strokeWidth: 2 },
        labelStyle: { fill: '#a78bfa', fontSize: 10 },
      },
      // ACTIONS → STATE (right to left: actions' left side to state's right side)
      {
        id: `e-${actionsGroupId}-${stateGroupId}`,
        source: actionsGroupId,
        target: stateGroupId,
        sourceHandle: 'left',
        targetHandle: 'right',
        type: 'smoothstep',
        animated: true,
        label: 'updates',
        style: { stroke: '#fb923c', strokeWidth: 2 },
        labelStyle: { fill: '#fb923c', fontSize: 10 },
      },
      // STATE → INVARIANTS (top to bottom: state's bottom to invariants' top)
      {
        id: `e-${stateGroupId}-${invGroupId}`,
        source: stateGroupId,
        target: invGroupId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'smoothstep',
        animated: true,
        label: 'checked by',
        style: { stroke: '#facc15', strokeWidth: 2 },
        labelStyle: { fill: '#facc15', fontSize: 10 },
      },
    ]

    get().pushHistory()
    set((state) => ({
      nodes: [...state.nodes, ...newNodes],
      edges: [...state.edges, ...newEdges],
    }))
  },

  addNodeToGroup: (groupId: string) => {
    // Read the group's role from its data
    const groupNode = get().nodes.find((n) => n.id === groupId)
    const groupData = groupNode?.data as RoleGroupData | undefined
    const groupRole = groupData?.role ?? 'step'

    const id = nanoid(8)

    // Determine node kind and defaults based on group role
    const roleConfig: Record<string, { kind: DeclKind; nodeType: string; defaults: Partial<VisualDeclaration> }> = {
      state: { kind: 'var', nodeType: 'state-var', defaults: { name: 'myVar', type: 'int' } },
      init: { kind: 'action', nodeType: 'action', defaults: { name: 'newInit', body: 'true', role: 'init' } },
      actions: { kind: 'action', nodeType: 'action', defaults: { name: 'newAction', params: '', body: 'true' } },
      step: { kind: 'action', nodeType: 'action', defaults: { name: 'step', params: '', body: 'true', role: 'step' } },
      invariant: { kind: 'val', nodeType: 'val', defaults: { name: 'newInvariant', body: 'true', role: 'invariant' } },
    }
    const config = roleConfig[groupRole] ?? roleConfig.step
    const decl = createDeclaration(id, config.kind, config.defaults)

    // Find the lowest child in this group to place the new one below it
    const children = get().nodes.filter((n) => n.parentId === groupId)
    let maxBottom = GROUP_HEADER + 5
    for (const child of children) {
      const h = child.measured?.height ?? 80
      const bottom = child.position.y + h + COLLISION_PAD
      if (bottom > maxBottom) maxBottom = bottom
    }

    const newNode: Node<AnyNodeData> = {
      id,
      type: config.nodeType,
      position: { x: GROUP_PADDING, y: maxBottom },
      data: { ...decl },
      parentId: groupId,
    }

    get().pushHistory()
    set((state) => ({
      nodes: resizeGroups([...state.nodes, newNode]),
      selectedNodeId: id,
    }))
  },

  updateDeclNode: (nodeId: string, updates: Partial<VisualDeclaration>) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
      ),
    }))
  },

  deleteDeclNode: (nodeId: string) => {
    get().pushHistory()
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    }))
  },

  setSelectedNode: (id) => set({ selectedNodeId: id }),
  toggleCodePreview: () => set((s) => ({ showCodePreview: !s.showCodePreview })),
  setPanelWidth: (width) => set({ panelWidth: width }),

  clearCanvas: () => {
    get().pushHistory()
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      panelWidth: 500,
    })
  },

  getQuintCode: () => {
    const { nodes, moduleName } = get()
    const decls = nodes
      .filter((n) => n.type !== 'role-group')
      .map((n) => n.data as VisualDeclaration)
    return declsToQuint(moduleName, decls)
  },
}), {
  name: 'quint-whiteboard',
  partialize: (state) => ({
    nodes: state.nodes,
    edges: state.edges,
    moduleName: state.moduleName,
    panelWidth: state.panelWidth,
  }),
}))
