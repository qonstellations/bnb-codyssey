import { Handle, Position } from '@xyflow/react'
import { Paper, Stack, Text } from '@mantine/core'

export default function BranchNode({ data, selected }) {
  const c = data.condition
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      style={{
        minWidth: 160,
        borderColor: selected ? 'var(--mantine-color-indigo-6)' : 'var(--mantine-color-orange-6)',
        borderWidth: selected ? 2 : 1,
        background: 'var(--mantine-color-body)',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Stack gap={2}>
        <Text fw={600} size="sm" c="orange">
          Branch
        </Text>
        <Text size="xs" c="dimmed">
          {c ? `${c.metric} ${c.operator} ${c.value}` : 'no condition set'}
        </Text>
      </Stack>
      <Handle type="source" position={Position.Right} />
    </Paper>
  )
}
