import { experimentSchema } from '../../shared/experimentSchema.js'

// Graph model: Start -> Block -> Block -> ... -> End is the MAIN chain (block order = execution
// order). BranchNode/LoopNode are attached decorations, not part of the main chain — they connect
// off a BlockNode via their own edges, matching the flat schema where branches/loops reference a
// block by id rather than occupying a position in the blocks[] array.

function blockNodeToSchema(node) {
  return {
    id: node.id,
    label: node.data.label ?? 'Untitled block',
    shuffle: node.data.shuffle ?? true,
    maxRepeats: node.data.maxRepeats ?? 2,
    repetitions: node.data.repetitions ?? 1,
    trials: node.data.trials ?? [],
  }
}

// nodes+edges -> experiment draft JSON. Returns { data, errors } (data is null if invalid).
export function compileToExperiment(nodes, edges, settings) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = new Map()
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, [])
    outgoing.get(e.source).push(e.target)
  }

  const start = nodes.find((n) => n.type === 'start')
  const blocks = []
  const visited = new Set()
  let currentId = start?.id

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const node = nodeById.get(currentId)
    if (!node) break
    if (node.type === 'block') blocks.push(blockNodeToSchema(node))
    if (node.type === 'end') break
    currentId = (outgoing.get(currentId) ?? []).find((id) => {
      const next = nodeById.get(id)
      return next?.type === 'block' || next?.type === 'end'
    })
  }

  const branches = []
  const loops = []
  for (const node of nodes) {
    if (node.type === 'branch') {
      const fromEdge = edges.find(
        (e) => e.target === node.id && nodeById.get(e.source)?.type === 'block'
      )
      const toEdge = edges.find(
        (e) => e.source === node.id && nodeById.get(e.target)?.type === 'block'
      )
      if (fromEdge && toEdge) {
        branches.push({
          id: node.id,
          from: fromEdge.source,
          to: toEdge.target,
          condition: node.data.condition,
        })
      }
    }
    if (node.type === 'loop') {
      const fromEdge = edges.find(
        (e) => e.target === node.id && nodeById.get(e.source)?.type === 'block'
      )
      if (fromEdge) {
        loops.push({ id: node.id, blockId: fromEdge.source, repetitions: node.data.repetitions })
      }
    }
  }

  const draft = { settings, blocks, branches, loops }
  const result = experimentSchema.safeParse(draft)
  if (result.success) return { data: result.data, errors: [] }

  const errors = (result.error.issues ?? []).map((issue) => ({
    path: issue.path.length ? issue.path.join('.') : '(root)',
    message: issue.message,
    // best-effort: surface the offending block id when the path points into blocks[i]
    nodeId: typeof issue.path[1] === 'number' ? blocks[issue.path[1]]?.id : undefined,
  }))
  return { data: null, errors }
}

const COLUMN_WIDTH = 240
const BLOCK_Y = 80
const DECORATION_Y = 260

// draft JSON -> nodes+edges, for loading saved work back into the canvas.
export function compileToGraph(draft) {
  const nodes = [{ id: 'start', type: 'start', position: { x: 0, y: BLOCK_Y }, data: {} }]
  const edges = []
  let x = COLUMN_WIDTH
  let previousId = 'start'

  for (const block of draft.blocks) {
    nodes.push({
      id: block.id,
      type: 'block',
      position: { x, y: BLOCK_Y },
      data: {
        label: block.label,
        shuffle: block.shuffle,
        maxRepeats: block.maxRepeats,
        repetitions: block.repetitions,
        trials: block.trials,
      },
    })
    edges.push({ id: `${previousId}-${block.id}`, source: previousId, target: block.id })
    previousId = block.id
    x += COLUMN_WIDTH
  }

  const endId = 'end'
  nodes.push({ id: endId, type: 'end', position: { x, y: BLOCK_Y }, data: {} })
  edges.push({ id: `${previousId}-${endId}`, source: previousId, target: endId })

  const blockX = new Map(draft.blocks.map((b, i) => [b.id, COLUMN_WIDTH * (i + 1)]))

  for (const branch of draft.branches ?? []) {
    nodes.push({
      id: branch.id,
      type: 'branch',
      position: { x: blockX.get(branch.from) ?? 0, y: DECORATION_Y },
      data: { condition: branch.condition },
    })
    edges.push({ id: `${branch.from}-${branch.id}`, source: branch.from, target: branch.id })
    edges.push({ id: `${branch.id}-${branch.to}`, source: branch.id, target: branch.to })
  }

  for (const loop of draft.loops ?? []) {
    nodes.push({
      id: loop.id,
      type: 'loop',
      position: { x: blockX.get(loop.blockId) ?? 0, y: DECORATION_Y + 120 },
      data: { repetitions: loop.repetitions },
    })
    edges.push({ id: `${loop.blockId}-${loop.id}`, source: loop.blockId, target: loop.id })
  }

  return { nodes, edges }
}
