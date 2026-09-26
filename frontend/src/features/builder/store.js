import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react'
import { compileToExperiment, compileToGraph } from './compile.js'

const HISTORY_LIMIT = 50

const DEFAULT_SETTINGS = {
  consentText: '',
  fullscreen: true,
  showProgressBar: true,
  instructionsText: '',
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontSize: 32,
}

const INITIAL_NODES = [
  { id: 'start', type: 'start', position: { x: 0, y: 80 }, data: {} },
  { id: 'end', type: 'end', position: { x: 240, y: 80 }, data: {} },
]
const INITIAL_EDGES = [{ id: 'start-end', source: 'start', target: 'end' }]

function snapshotOf(nodes, edges, settings) {
  return { nodes, edges, settings }
}

let nodeCounter = 0
function nextId(prefix) {
  nodeCounter += 1
  return `${prefix}_${Date.now()}_${nodeCounter}`
}

// Every history-worthy mutation goes through here: compute the next {nodes,edges,settings},
// then push it as a new history entry (truncating any redo branch past the current index).
function commit(set, get, next) {
  const state = get()
  const merged = {
    nodes: next.nodes ?? state.nodes,
    edges: next.edges ?? state.edges,
    settings: next.settings ?? state.settings,
  }
  const history = state.history
    .slice(0, state.historyIndex + 1)
    .concat([snapshotOf(merged.nodes, merged.edges, merged.settings)])
  const trimmed = history.length > HISTORY_LIMIT ? history.slice(history.length - HISTORY_LIMIT) : history
  set({ ...merged, isDirty: true, history: trimmed, historyIndex: trimmed.length - 1 })
}

export const useBuilderStore = create((set, get) => ({
  nodes: INITIAL_NODES,
  edges: INITIAL_EDGES,
  settings: DEFAULT_SETTINGS,
  selectedNodeId: null,
  isDirty: false,
  history: [snapshotOf(INITIAL_NODES, INITIAL_EDGES, DEFAULT_SETTINGS)],
  historyIndex: 0,

  // Drag/resize/selection-box changes from React Flow — not undo-tracked (too noisy per-frame).
  onNodesChange(changes) {
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }))
  },

  onEdgesChange(changes) {
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }))
  },

  connect(connection) {
    const state = get()
    commit(set, get, { edges: addEdge(connection, state.edges) })
  },

  addNode(type, position, data = {}) {
    const id = nextId(type)
    const state = get()
    commit(set, get, { nodes: [...state.nodes, { id, type, position, data }] })
    return id
  },

  updateNode(id, data) {
    const state = get()
    commit(set, get, {
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    })
  },

  removeEdge(id) {
    commit(set, get, { edges: get().edges.filter((e) => e.id !== id) })
  },

  removeNode(id) {
    const state = get()
    commit(set, get, {
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    })
    if (get().selectedNodeId === id) set({ selectedNodeId: null })
  },

  select(id) {
    set({ selectedNodeId: id })
  },

  setSettings(patch) {
    const state = get()
    commit(set, get, { settings: { ...state.settings, ...patch } })
  },

  undo() {
    const state = get()
    if (state.historyIndex <= 0) return
    const index = state.historyIndex - 1
    const snap = state.history[index]
    set({ ...snap, historyIndex: index, isDirty: true })
  },

  redo() {
    const state = get()
    if (state.historyIndex >= state.history.length - 1) return
    const index = state.historyIndex + 1
    const snap = state.history[index]
    set({ ...snap, historyIndex: index, isDirty: true })
  },

  canUndo() {
    return get().historyIndex > 0
  },

  canRedo() {
    const state = get()
    return state.historyIndex < state.history.length - 1
  },

  loadFromJson(draft) {
    const { nodes, edges } = compileToGraph(draft)
    const settings = draft.settings ?? DEFAULT_SETTINGS
    set({
      nodes,
      edges,
      settings,
      selectedNodeId: null,
      isDirty: false,
      history: [snapshotOf(nodes, edges, settings)],
      historyIndex: 0,
    })
  },

  reset() {
    set({
      nodes: INITIAL_NODES,
      edges: INITIAL_EDGES,
      settings: DEFAULT_SETTINGS,
      selectedNodeId: null,
      isDirty: false,
      history: [snapshotOf(INITIAL_NODES, INITIAL_EDGES, DEFAULT_SETTINGS)],
      historyIndex: 0,
    })
  },

  compile() {
    const state = get()
    return compileToExperiment(state.nodes, state.edges, state.settings)
  },

  markSaved() {
    set({ isDirty: false })
  },
}))
