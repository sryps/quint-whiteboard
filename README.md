# Quint Whiteboard

A visual editor for building [Quint](https://quint-lang.org/) formal specifications. Drag, drop, and connect declarations on an interactive canvas, then generate valid Quint code, typecheck it, and run simulations -- all from the browser.

## Features

- **Visual canvas** -- State variables, constants, actions, values, definitions, and types as draggable nodes powered by React Flow
- **State machine template** -- One-click scaffold with state, init, step, actions, and invariants pre-wired with directional edges
- **Code generation** -- Automatically produces a valid `.qnt` module from the canvas, including `run` test declarations
- **Typecheck & simulation** -- Built-in panels for `quint typecheck`, `quint run` (with invariant detection), and expression evaluation
- **Inline syntax check** -- Check button on the Body field runs a full typecheck in context and shows errors inline
- **Persistent canvas** -- Nodes, edges, module name, and panel width survive browser refreshes via localStorage
- **Undo / redo** -- Ctrl+Z / Ctrl+Shift+Z with full history stack
- **Resizable property panel** -- Drag the left edge to resize; width persists across sessions
- **Section tooltips** -- Hover the `?` on any group header (STATE, INIT, ACTIONS, STEP, INVARIANTS) for a description of its role
- **Clear canvas** -- One-click clear with confirmation dialog and full undo support

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Quint](https://quint-lang.org/) CLI binary available on your `PATH` -- the app calls `quint` directly for typechecking, simulation, and evaluation

```bash
npm i -g @informalsystems/quint
quint --version   # verify it's on PATH
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build

```bash
npm run build
npm run preview
```

## Tech Stack

| Layer | Library |
|-------|---------|
| UI | React 19, TypeScript 5.9 |
| Canvas | @xyflow/react 12 |
| State | Zustand 5 (with persist middleware) |
| Styling | Tailwind CSS 4 |
| Bundler | Vite 7 |
| Spec language | Quint |

## Project Structure

```
src/
  model/
    spec.ts        # DeclNodeData types, code generation, state machine template
    store.ts       # Zustand store (nodes, edges, history, persistence)
  components/
    Canvas/
      WhiteboardCanvas.tsx   # React Flow canvas with node types
    Nodes/
      DeclNodes.tsx          # Node components (Pill, Card, Shield, RoleGroup)
    Panels/
      Toolbar.tsx            # Top toolbar (add nodes, undo/redo, clear)
      PropertyPanel.tsx      # Right panel (edit selected node, syntax check)
      CodePreview.tsx        # Generated Quint code overlay
      ExecutionPanel.tsx     # Run, typecheck, eval panels
  App.tsx                    # Root layout
vite.config.ts               # Vite config + Quint API middleware
```

## License

[MIT](./LICENSE)
