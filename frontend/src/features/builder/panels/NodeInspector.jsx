import { NumberInput, Stack, Text } from '@mantine/core'
import { useBuilderStore } from '../store.js'
import BlockEditor from './BlockEditor.jsx'
import BranchEditor from './BranchEditor.jsx'
import SettingsPanel from './SettingsPanel.jsx'

export default function NodeInspector() {
  const nodes = useBuilderStore((s) => s.nodes)
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId)
  const updateNode = useBuilderStore((s) => s.updateNode)

  const node = nodes.find((n) => n.id === selectedNodeId)

  if (!node) return <SettingsPanel />

  if (node.type === 'block') {
    return <BlockEditor node={node} onChange={(patch) => updateNode(node.id, patch)} />
  }

  if (node.type === 'branch') {
    return <BranchEditor node={node} onChange={(patch) => updateNode(node.id, patch)} />
  }

  if (node.type === 'loop') {
    return (
      <Stack gap="sm">
        <Text size="xs" fw={700} c="dimmed">
          LOOP
        </Text>
        <Text size="sm">Repeats the connected block in place.</Text>
        <NumberInput
          label="Repetitions"
          min={2}
          max={100}
          value={node.data.repetitions ?? 2}
          onChange={(v) => updateNode(node.id, { repetitions: Number(v) || 2 })}
        />
      </Stack>
    )
  }

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {node.type === 'start' ? 'Start of the experiment.' : 'End of the experiment.'}
      </Text>
    </Stack>
  )
}
