export type DeclKind = 'var' | 'const' | 'val' | 'def' | 'action' | 'type' | 'assume'

export interface VisualDeclaration {
  id: string
  kind: DeclKind
  name: string
  type: string
  params: string
  body: string
  /** Marks special state machine roles */
  role?: 'init' | 'step' | 'invariant'
  /** Whether this is a pure val/def (no state dependency) */
  pure?: boolean
}

/** Node data stored on each React Flow node */
export type DeclNodeData = VisualDeclaration & { [key: string]: unknown }

/** Data for a role-group container node (purely visual, not a declaration) */
export interface RoleGroupData {
  isGroup: true
  role: 'state' | 'init' | 'step' | 'invariant' | 'actions'
  label: string
  [key: string]: unknown
}

export function createDeclaration(
  id: string,
  kind: DeclKind,
  overrides: Partial<VisualDeclaration> = {}
): VisualDeclaration {
  return {
    id,
    kind,
    name: '',
    type: '',
    params: '',
    body: '',
    ...overrides,
  }
}

/** Create a state machine scaffold matching the Quint bank example */
export function createStateMachineDecls(idGen: () => string): VisualDeclaration[] {
  return [
    createDeclaration(idGen(), 'var', { name: 'balances', type: 'str -> int' }),
    createDeclaration(idGen(), 'val', {
      name: 'ADDRESSES',
      body: 'Set("alice", "bob", "charlie")',
      pure: true,
    }),
    createDeclaration(idGen(), 'action', {
      name: 'init',
      body: "balances' = ADDRESSES.mapBy(_ => 0)",
      role: 'init',
    }),
    createDeclaration(idGen(), 'action', {
      name: 'deposit',
      params: 'account, amount',
      body: "balances' = balances.setBy(account, curr => curr + amount)",
    }),
    createDeclaration(idGen(), 'action', {
      name: 'withdraw',
      params: 'account, amount',
      body: "balances' = balances.setBy(account, curr => curr - amount)",
    }),
    createDeclaration(idGen(), 'action', {
      name: 'step',
      body: 'nondet account = ADDRESSES.oneOf()\nnondet amount = 1.to(100).oneOf()\nany {\n  deposit(account, amount),\n  withdraw(account, amount),\n}',
      role: 'step',
    }),
    createDeclaration(idGen(), 'val', {
      name: 'no_negatives',
      body: 'ADDRESSES.forall(addr => balances.get(addr) >= 0)',
      role: 'invariant',
    }),
  ]
}

function indentLines(text: string, indent: string): string {
  return text
    .split('\n')
    .map((l) => indent + l)
    .join('\n')
}

export function declToQuint(d: VisualDeclaration): string {
  const name = d.name || '_unnamed'

  switch (d.kind) {
    case 'var':
    case 'const':
      return `  ${d.kind} ${name}: ${d.type || 'int'}`

    case 'val': {
      const pureVal = d.pure ? 'pure ' : ''
      return `  ${pureVal}val ${name}${d.type ? ': ' + d.type : ''} = ${d.body || '???'}`
    }

    case 'def':
    case 'action': {
      const pureDef = d.pure && d.kind === 'def' ? 'pure ' : ''
      const params = d.params ? `(${d.params})` : ''
      const ret = d.type ? ': ' + d.type : ''
      const body = d.body || '???'
      if (body.includes('\n')) {
        const trimmed = body.trimStart()
        const hasBindings = body.split('\n').some((l) => /^\s*(nondet|val)\s/.test(l))
        const alreadyWrapped = trimmed.startsWith('all ') || trimmed.startsWith('any ')
        // Action bodies with multiple plain lines need all { } with commas
        if (d.kind === 'action' && !hasBindings && !alreadyWrapped) {
          const clauses = body
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => {
              const clean = l.endsWith(',') ? l : l + ','
              return `    ${clean}`
            })
            .join('\n')
          return `  action ${name}${params}${ret} = all {\n${clauses}\n  }`
        }
        return `  ${pureDef}${d.kind} ${name}${params}${ret} = {\n${indentLines(body, '    ')}\n  }`
      }
      return `  ${pureDef}${d.kind} ${name}${params}${ret} = ${body}`
    }

    case 'type':
      return `  type ${name} = ${d.body || 'int'}`

    case 'assume':
      return `  assume ${name} = ${d.body || 'true'}`
  }
}

/** Sort order for declaration kinds in generated code */
const KIND_ORDER: Record<DeclKind, number> = {
  type: 0,
  const: 1,
  var: 2,
  val: 3,
  def: 4,
  action: 5,
  assume: 6,
}

/** Extract param names from a params string like "amount: int, name: str" */
function parseParamNames(params: string): string[] {
  if (!params.trim()) return []
  return params.split(',').map((p) => p.split(':')[0].trim()).filter(Boolean)
}

/** Extract unique {name, type} pairs from params across multiple actions */
function collectUniqueParams(actions: VisualDeclaration[]): { name: string; type: string }[] {
  const seen = new Map<string, string>()
  for (const a of actions) {
    if (!a.params?.trim()) continue
    for (const part of a.params.split(',')) {
      const [name, type] = part.split(':').map((s) => s.trim())
      if (name && !seen.has(name)) {
        seen.set(name, type || 'int')
      }
    }
  }
  return [...seen.entries()].map(([name, type]) => ({ name, type }))
}

/** Pick a sensible nondet range for a Quint type */
function nondetRange(type: string): string {
  const t = type.toLowerCase()
  if (t === 'bool') return 'Set(true, false)'
  if (t === 'str') return 'Set("a", "b", "c")'
  return '1.to(100)'
}

/** Generate combined init/step actions when multiple actions share a role */
function generateCombinedActions(decls: VisualDeclaration[]): string[] {
  const extra: string[] = []

  const initActions = decls.filter((d) => d.role === 'init' && d.kind === 'action')
  const stepActions = decls.filter((d) => d.role === 'step' && d.kind === 'action')

  // Combined init: needed if multiple init actions, or single init not named "init"
  const hasExplicitInit = decls.some((d) => d.name === 'init' && d.kind === 'action')
  const needsInit =
    !hasExplicitInit &&
    (initActions.length > 1 ||
      (initActions.length === 1 && initActions[0].name !== 'init'))
  if (needsInit) {
    const calls = initActions.map((a) => `    ${a.name}`).join(',\n')
    if (initActions.length === 1) {
      extra.push(`  action init = ${initActions[0].name}`)
    } else {
      extra.push(`  action init = all {\n${calls},\n  }`)
    }
  }

  // Combined step: needed if multiple step actions, or single step not named "step"
  const hasExplicitStep = decls.some((d) => d.name === 'step' && d.kind === 'action')
  const needsStep =
    !hasExplicitStep &&
    (stepActions.length > 1 ||
      (stepActions.length === 1 && stepActions[0].name !== 'step'))
  if (needsStep) {
    const params = collectUniqueParams(stepActions)
    const calls = stepActions
      .map((a) => {
        const args = parseParamNames(a.params).join(', ')
        return `    ${a.name}${args ? `(${args})` : ''}`
      })
      .join(',\n')

    if (params.length > 0) {
      const bindings = params
        .map((p) => `    nondet ${p.name} = ${nondetRange(p.type)}.oneOf()`)
        .join('\n')
      extra.push(`  action step = {\n${bindings}\n    any {\n${calls},\n    }\n  }`)
    } else {
      extra.push(`  action step = any {\n${calls},\n  }`)
    }
  }

  // Auto-generate a test run when init + step exist
  const hasInit =
    initActions.length > 0 || decls.some((d) => d.name === 'init' && d.kind === 'action')
  const hasStep =
    stepActions.length > 0 || decls.some((d) => d.name === 'step' && d.kind === 'action')

  if (hasInit && hasStep) {
    const invariants = decls.filter(
      (d) => d.role === 'invariant' && d.name && (d.kind === 'val' || d.kind === 'def')
    )

    if (invariants.length > 0) {
      const predicate = invariants.map((inv) => inv.name).join(' and ')
      extra.push(
        `  run invariantTest = init.then(20.reps(_ => step.expect(${predicate})))`
      )
    } else {
      extra.push(`  run simulationTest = init.then(20.reps(_ => step))`)
    }
  }

  return extra
}

/** Generate Quint code from a flat list of declarations and a module name */
export function declsToQuint(moduleName: string, decls: VisualDeclaration[]): string {
  if (decls.length === 0) return `module ${moduleName || 'Unnamed'} {\n}`
  const sorted = [...decls].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
  const lines = sorted.map(declToQuint)
  const combined = generateCombinedActions(decls)
  const body = [...lines, ...combined].join('\n\n')
  return `module ${moduleName || 'Unnamed'} {\n${body}\n}`
}

/** Detect state machine roles by name convention */
export function inferRole(name: string): VisualDeclaration['role'] {
  const lower = name.toLowerCase()
  if (lower === 'init') return 'init'
  if (lower === 'step' || lower === 'next') return 'step'
  if (lower.startsWith('inv') || lower.endsWith('invariant')) return 'invariant'
  return undefined
}
