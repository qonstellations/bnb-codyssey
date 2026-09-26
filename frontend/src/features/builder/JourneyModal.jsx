import { Modal, Stack, Text } from '@mantine/core'
import { useBuilderStore } from './store.js'
import { conditionText, estTimeText } from './format.js'

// Read-only participant journey: what the participant actually experiences,
// in order. Derived from the compiled draft — no separate system.
export default function JourneyModal({ opened, onClose }) {
  const compile = useBuilderStore((s) => s.compile)
  const settings = useBuilderStore((s) => s.settings)
  const { data, errors } = compile()

  return (
    <Modal opened={opened} onClose={onClose} title="Participant journey" size="sm">
      {!data ? (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            The journey appears once the experiment is valid:
          </Text>
          {(errors ?? []).slice(0, 4).map((e, i) => (
            <Text key={i} size="sm" c="red">
              • {e.friendly ?? e.message}
            </Text>
          ))}
        </Stack>
      ) : (
        <Stack gap={4}>
          <JourneyStep first label="Start" hint="Participant opens the link" />
          {settings.instructionsText && (
            <JourneyStep label="Instructions" hint="They read before starting" />
          )}
          {data.blocks.map((b) => (
            <JourneyStep
              key={b.id}
              label={b.label}
              hint={`${b.trials.length} trial${b.trials.length === 1 ? '' : 's'}${estTimeText(b.trials) ? ` · ${estTimeText(b.trials)}` : ''}${b.repetitions > 1 ? ` · repeated ${b.repetitions}x` : ''}`}
            />
          ))}
          {(data.branches ?? []).map((br) => (
            <Text key={br.id} size="xs" c="dimmed" pl="md">
              ↳ Decision: if {conditionText(br.condition)}, go to{' '}
              {data.blocks.find((b) => b.id === br.to)?.label ?? 'another step'}
            </Text>
          ))}
          <JourneyStep last label="End" hint="Thank-you screen" />
        </Stack>
      )}
    </Modal>
  )
}

function JourneyStep({ label, hint, first, last }) {
  return (
    <div>
      {!first && (
        <Text size="xs" c="dimmed" pl="md">
          ↓
        </Text>
      )}
      <Text size="sm" fw={600} pl={last || first ? 0 : 'md'}>
        {label}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed" pl={last || first ? 0 : 'md'}>
          {hint}
        </Text>
      )}
    </div>
  )
}
