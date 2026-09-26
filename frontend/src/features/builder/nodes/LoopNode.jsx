import { Handle, Position } from '@xyflow/react'
import { Paper, Stack, Text } from '@mantine/core'

export default function LoopNode({ data, selected }) {
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      style={{
        minWidth: 140,
        borderColor: selected ? 'var(--mantine-color-indigo-6)' : 'var(--mantine-color-grape-6)',
        borderWidth: selected ? 2 : 1,
        background: 'var(--mantine-color-body)',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Stack gap={2}>
        <Text fw={600} size="sm" c="grape">
          Loop
        </Text>
        <Text size="xs" c="dimmed">
          repeat {data.repetitions ?? 2}x
        </Text>
      </Stack>
    </Paper>
  )
}
