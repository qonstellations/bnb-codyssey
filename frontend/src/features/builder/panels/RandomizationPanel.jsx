import { Group, NumberInput, Stack, Switch, Text } from '@mantine/core'

export default function RandomizationPanel({ block, onChange }) {
  return (
    <Stack gap="xs">
      <Text size="xs" fw={700} c="dimmed">
        RANDOMIZATION
      </Text>
      <Group justify="space-between">
        <Text size="sm">Shuffle trials</Text>
        <Switch
          checked={block.shuffle ?? true}
          onChange={(e) => onChange({ shuffle: e.currentTarget.checked })}
        />
      </Group>
      <NumberInput
        label="Max repeats in a row"
        min={1}
        max={20}
        value={block.maxRepeats ?? 2}
        onChange={(v) => onChange({ maxRepeats: Number(v) || 1 })}
      />
      <NumberInput
        label="Block repetitions"
        min={1}
        max={100}
        value={block.repetitions ?? 1}
        onChange={(v) => onChange({ repetitions: Number(v) || 1 })}
      />
    </Stack>
  )
}
