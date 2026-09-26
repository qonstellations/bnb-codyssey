import { Group, NumberInput, Select, Stack, Text } from '@mantine/core'

const METRICS = ['accuracy', 'meanRt', 'completionRate']
const OPERATORS = ['<', '<=', '>', '>=', '==', '!=']

export default function BranchEditor({ node, onChange }) {
  const condition = node.data.condition ?? { metric: 'accuracy', operator: '<', value: 0.7 }

  function update(patch) {
    onChange({ condition: { ...condition, ...patch } })
  }

  return (
    <Stack gap="sm">
      <Text size="xs" fw={700} c="dimmed">
        BRANCH CONDITION
      </Text>
      <Text size="xs" c="dimmed">
        Jumps to the connected block when this condition, evaluated on the block feeding into
        this branch, is true.
      </Text>
      <Select
        label="Metric"
        data={METRICS}
        value={condition.metric}
        onChange={(v) => update({ metric: v })}
      />
      <Group grow>
        <Select
          label="Operator"
          data={OPERATORS}
          value={condition.operator}
          onChange={(v) => update({ operator: v })}
        />
        <NumberInput
          label="Value"
          step={0.05}
          value={condition.value}
          onChange={(v) => update({ value: Number(v) || 0 })}
        />
      </Group>
    </Stack>
  )
}
