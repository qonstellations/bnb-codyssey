import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './flow.css'
import { Group, Paper, Stack, Text } from '@mantine/core'
import { useBuilderStore } from './store.js'
import { nodeTypes, NODE_PALETTE } from './nodes/index.js'

const DEFAULT_DATA = {
  block: { label: 'New block', shuffle: true, maxRepeats: 2, repetitions: 1, trials: [] },
  branch: { condition: { metric: 'accuracy', operator: '<', value: 0.7 } },
  loop: { repetitions: 2 },
}

const NODE_DOT = {
  block: '#4285f4',
  branch: '#fbbc04',
  loop: '#a142f4',
  start: '#34a853',
  end: '#ea4335',
}

const EDGE_DEFAULTS = { type: 'smoothstep', pathOptions: { borderRadius: 16 } }

function Palette() {
  const onDragStart = (event, type) => {
    event.dataTransfer.setData('application/builder-node-type', type)
    event.dataTransfer.effectAllowed = 'move'
  }
  return (
    <Stack
      gap="xs"
      p="sm"
      style={{
        width: 176,
        flexShrink: 0,
        borderRight: '1px solid var(--mantine-color-gray-3)',
        background: '#fff',
        overflowY: 'auto',
      }}
    >
      <Text size="sm" fw={700}>
        Add nodes
      </Text>
      <Text size="xs" c="dimmed">
        Drag one onto the whiteboard.
      </Text>
      {NODE_PALETTE.map((item) => (
        <Paper
          key={item.type}
          withBorder
          p="xs"
          radius="xl"
          className="ag-hover-card"
          draggable
          onDragStart={(e) => onDragStart(e, item.type)}
          style={{ cursor: 'grab', textAlign: 'center' }}
        >
          <Group gap="xs" justify="center">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: NODE_DOT[item.type] ?? 'var(--mantine-color-gray-5)',
                flexShrink: 0,
              }}
            />
            <Text size="sm">{item.label}</Text>
          </Group>
        </Paper>
      ))}
      <Text size="xs" c="dimmed" mt="sm">
        Connect nodes by dragging from a handle. Select a node to edit it on the right.
      </Text>
    </Stack>
  )
}

function FlowCanvas() {
  const { screenToFlowPosition } = useReactFlow()
  const nodes = useBuilderStore((s) => s.nodes)
  const storeEdges = useBuilderStore((s) => s.edges)
  // Stored/compiled edges carry no type — apply the rounded smoothstep look to all of them.
  const edges = useMemo(() => storeEdges.map((e) => ({ ...EDGE_DEFAULTS, ...e })), [storeEdges])
  const onNodesChange = useBuilderStore((s) => s.onNodesChange)
  const onEdgesChange = useBuilderStore((s) => s.onEdgesChange)
  const connect = useBuilderStore((s) => s.connect)
  const addNode = useBuilderStore((s) => s.addNode)
  const removeNode = useBuilderStore((s) => s.removeNode)
  const removeEdge = useBuilderStore((s) => s.removeEdge)
  const select = useBuilderStore((s) => s.select)
  const wrapRef = useRef(null)
  // Clicked edge/node + where to float its delete pill (px, relative to the canvas wrapper).
  const [menu, setMenu] = useState(null)

  const menuAt = (event, kind, id) => {
    const r = wrapRef.current.getBoundingClientRect()
    setMenu({ kind, id, x: event.clientX - r.left, y: event.clientY - r.top })
  }

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/builder-node-type')
      if (!type) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      addNode(type, position, DEFAULT_DATA[type] ?? {})
    },
    [screenToFlowPosition, addNode]
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onNodeClick = (event, node) => {
    select(node.id)
    if (node.id === 'start' || node.id === 'end') setMenu(null)
    else menuAt(event, 'node', node.id)
  }
  const onPaneClick = useCallback(() => {
    setMenu(null)
    select(null)
  }, [select])
  const onEdgeClick = (event, edge) => menuAt(event, 'edge', edge.id)
  const deleteSelected = () => {
    if (menu.kind === 'edge') removeEdge(menu.id)
    else removeNode(menu.id)
    setMenu(null)
  }

  const onKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') setMenu(null)
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (menu?.kind === 'edge') {
        removeEdge(menu.id)
        setMenu(null)
        return
      }
      const selectedId = useBuilderStore.getState().selectedNodeId
      if (selectedId && selectedId !== 'start' && selectedId !== 'end') {
        removeNode(selectedId)
        setMenu(null)
      }
    },
    [removeNode, removeEdge, menu]
  )

  const hasBlocks = nodes.some((n) => n.type === 'block')

  return (
    <div
      ref={wrapRef}
      style={{ flex: 1, minHeight: 0, minWidth: 0, background: '#fcfcfd', position: 'relative' }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={connect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        onMoveStart={() => setMenu(null)}
        onNodeDragStart={() => setMenu(null)}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.3, duration: 400 }}
        colorMode="light"
      >
        <Background variant="dots" gap={22} size={1.4} color="#dadce0" bgColor="#fcfcfd" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          nodeBorderRadius={12}
          nodeColor={(n) => NODE_DOT[n.type] ?? '#bdc1c6'}
          nodeStrokeWidth={0}
          maskColor="rgba(241, 243, 244, 0.7)"
          style={{ width: 180, height: 120 }}
        />
      </ReactFlow>
      {menu && (menu.kind === 'edge' ? edges : nodes).some((x) => x.id === menu.id) && (
        <button
          type="button"
          className="flow-edge-delete"
          style={{ left: menu.x + 10, top: menu.y + 10 }}
          onClick={deleteSelected}
          autoFocus
        >
          ✕ Delete {menu.kind === 'edge' ? 'line' : nodes.find((n) => n.id === menu.id)?.type ?? 'node'}
        </button>
      )}
      {!hasBlocks && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Text
            size="sm"
            c="dimmed"
            style={{ background: '#fff', padding: '8px 16px', borderRadius: 999, border: '1px solid #e8eaed' }}
          >
            Drag a Block from the left to start building
          </Text>
        </div>
      )}
    </div>
  )
}

export default function Canvas() {
  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0 }}>
      <Palette />
      <ReactFlowProvider>
        <FlowCanvas />
      </ReactFlowProvider>
    </div>
  )
}
