import { Group, NumberInput, Select, Stack, Text } from '@mantine/core'
import { useBuilderStore } from '../store.js'
import { conditionText, isPercentMetric } from '../format.js'

const METRICS = [
  { value: 'accuracy', label: "Participant's accuracy" },
  { value: 'meanRt', label: 'Average response time' },
  { value: 'completionRate', label: 'Completion rate' },
]

const OPERATORS = [
  { value: '<', label: 'is less than' },
  { value: '<=', label: 'is at most' },
  { value: '>', label: 'is more than' },
  { value: '>=', label: 'is at least' },
  { value: '==', label: 'is exactly' },
  { value: '!=', label: 'is not' },
]

export default function BranchEditor({ node, onChange }) {
  const condition = node.data.condition ?? { metric: 'accuracy', operator: '<', value: 0.7 }
  const nodes = useBuilderStore((s) => s.nodes)
  const edges = useBuilderStore((s) => s.edges)

  function update(patch) {
    onChange({ condition: { ...condition, ...patch } })
  }

  const labelOf = (id) => nodes.find((n) => n.id === id)?.data.label ?? 'next step'
  const fromEdge = edges.find((e) => e.target === node.id)
  const toEdge = edges.find((e) => e.source === node.id)
  const fromLabel = fromEdge ? labelOf(fromEdge.source) : null
  const toLabel = toEdge ? labelOf(toEdge.target) : null
  const percent = isPercentMetric(condition.metric)

  return (
    <Stack gap="sm">
      <Text size="xs" fw={600}>
        Condition
      </Text>
      <Select
        label="Participant's"
        data={METRICS}
        value={condition.metric}
        onChange={(v) => update({ metric: v, value: v === 'meanRt' ? 800 : 0.7 })}
      />
      <Group grow>
        <Select
          label="Is"
          data={OPERATORS}
          value={condition.operator}
          onChange={(v) => update({ operator: v })}
        />
        <NumberInput
          label={percent ? 'Value (%)' : 'Value (ms)'}
          min={percent ? 0 : 1}
          max={percent ? 100 : 60000}
          step={percent ? 1 : 50}
          value={percent ? Math.round(condition.value * 100) : condition.value}
          onChange={(v) => update({ value: percent ? (Number(v) || 0) / 100 : Number(v) || 0 })}
        />
      </Group>

      <Group grow>
        <Text size="xs">
          <Text span fw={600} c="green">
            If true →
          </Text>{' '}
          {toLabel ?? 'nothing yet — draw a line out of this Decision'}
        </Text>
      </Group>
      <Text size="xs">
        <Text span fw={600} c="dimmed">
          If false →
        </Text>{' '}
        participants continue along the main flow
        {fromLabel ? ` after ${fromLabel}` : ''}.
      </Text>

      {toLabel && (
        <Text size="xs" c="dimmed" style={{ borderTop: '1px solid var(--mantine-color-gray-3)', paddingTop: 8 }}>
          In simple terms: participants whose {conditionText(condition)}
          {fromLabel ? ` in ${fromLabel}` : ''} will go to {toLabel}.
        </Text>
      )}
    </Stack>
  )
}
