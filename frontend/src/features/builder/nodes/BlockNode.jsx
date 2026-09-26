import { Handle, Position } from '@xyflow/react'
import { Paper, Stack, Text } from '@mantine/core'

export default function BlockNode({ data, selected }) {
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      style={{
        minWidth: 160,
        borderColor: selected ? 'var(--mantine-color-indigo-6)' : undefined,
        borderWidth: selected ? 2 : 1,
        background: 'var(--mantine-color-body)',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Stack gap={2}>
        <Text fw={600} size="sm">
          {data.label || 'Untitled block'}
        </Text>
        <Text size="xs" c="dimmed">
          {data.trials?.length ?? 0} trial{(data.trials?.length ?? 0) === 1 ? '' : 's'}
        </Text>
      </Stack>
      <Handle type="source" position={Position.Right} id="out" />
      <Handle type="source" position={Position.Bottom} id="decor" style={{ background: '#999' }} />
    </Paper>
  )
}
