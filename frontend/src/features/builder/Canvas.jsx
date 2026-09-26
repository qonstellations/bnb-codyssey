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
import { Group, Paper, Stack, Text } from '@mantine/core'
import { useBuilderStore } from './store.js'
import { nodeTypes, NODE_PALETTE } from './nodes/index.js'

const DEFAULT_DATA = {
  block: { label: 'New block', shuffle: true, maxRepeats: 2, repetitions: 1, trials: [] },
  branch: { condition: { metric: 'accuracy', operator: '<', value: 0.7 } },
  loop: { repetitions: 2 },
}

const NODE_DOT = {
  block: 'var(--mantine-color-teal-6)',
  branch: 'var(--mantine-color-orange-6)',
  loop: 'var(--mantine-color-grape-6)',
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

  const hasBlocks = nodes.some((n) => n.type === 'block')

  return (
    <div
      style={{ flex: 1, minHeight: 0, minWidth: 0, background: '#fafaf8', position: 'relative' }}
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
        colorMode="light"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant="dots" gap={24} size={1.6} color="#cfccc0" bgColor="#fafaf8" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
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
          <Text size="sm" c="dimmed" style={{ background: '#fafaf8', padding: '4px 12px' }}>
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
