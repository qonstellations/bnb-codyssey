import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Paper, Stack, Text } from '@mantine/core'
import { useBuilderStore } from './store.js'
import { nodeTypes, NODE_PALETTE } from './nodes/index.js'

const DEFAULT_DATA = {
  block: { label: 'New block', shuffle: true, maxRepeats: 2, repetitions: 1, trials: [] },
  branch: { condition: { metric: 'accuracy', operator: '<', value: 0.7 } },
  loop: { repetitions: 2 },
}

function Palette() {
  const onDragStart = (event, type) => {
    event.dataTransfer.setData('application/builder-node-type', type)
    event.dataTransfer.effectAllowed = 'move'
  }
  return (
    <Stack
      gap="xs"
      p="sm"
      style={{ width: 140, borderRight: '1px solid var(--mantine-color-gray-3)' }}
    >
      <Text size="xs" fw={700} c="dimmed">
        DRAG TO ADD
      </Text>
      {NODE_PALETTE.map((item) => (
        <Paper
          key={item.type}
          withBorder
          p="xs"
          draggable
          onDragStart={(e) => onDragStart(e, item.type)}
          style={{ cursor: 'grab', textAlign: 'center' }}
        >
          <Text size="sm">{item.label}</Text>
        </Paper>
      ))}
    </Stack>
  )
}

function FlowCanvas() {
  const { screenToFlowPosition } = useReactFlow()
  const nodes = useBuilderStore((s) => s.nodes)
  const edges = useBuilderStore((s) => s.edges)
  const onNodesChange = useBuilderStore((s) => s.onNodesChange)
  const onEdgesChange = useBuilderStore((s) => s.onEdgesChange)
  const connect = useBuilderStore((s) => s.connect)
  const addNode = useBuilderStore((s) => s.addNode)
  const removeNode = useBuilderStore((s) => s.removeNode)
  const select = useBuilderStore((s) => s.select)

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

  const onNodeClick = useCallback((_event, node) => select(node.id), [select])
  const onPaneClick = useCallback(() => select(null), [select])

  const onKeyDown = useCallback(
    (event) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const selectedId = useBuilderStore.getState().selectedNodeId
      if (selectedId && selectedId !== 'start' && selectedId !== 'end') removeNode(selectedId)
    },
    [removeNode]
  )

  return (
    <div
      style={{ flex: 1, height: '100%' }}
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
        deleteKeyCode={null}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

export default function Canvas() {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <Palette />
      <ReactFlowProvider>
        <FlowCanvas />
      </ReactFlowProvider>
    </div>
  )
}
