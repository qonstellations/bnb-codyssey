import { useState } from 'react'
import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  TextInput,
} from '@mantine/core'
import StimulusPicker from '../../stimuli/StimulusPicker.jsx'

function emptyTrial() {
  return {
    id: `trial_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    stimulus: { type: 'text', content: '', url: null },
    duration: 2000,
    fixationDuration: 500,
    validKeys: ['f', 'j'],
    correctKey: 'f',
    condition: '',
    feedback: { correct: '', incorrect: '' },
    timeoutMs: null,
    itiMs: 500,
  }
}

// Controlled form for one trial. `trial` null means "new trial".
export default function TrialForm({ trial, onSave, onCancel }) {
  const [value, setValue] = useState(() => trial ?? emptyTrial())
  const [pickerOpen, setPickerOpen] = useState(false)

  const keyMismatch =
    value.correctKey && value.validKeys.length > 0 && !value.validKeys.includes(value.correctKey)

  function patch(fields) {
    setValue((v) => ({ ...v, ...fields }))
  }

  function patchStimulus(fields) {
    setValue((v) => ({ ...v, stimulus: { ...v.stimulus, ...fields } }))
  }

  function patchFeedback(fields) {
    setValue((v) => ({ ...v, feedback: { ...v.feedback, ...fields } }))
  }

  return (
    <Stack gap="sm">
      <Group grow>
        <TextInput label="Trial ID" value={value.id} readOnly />
        <TextInput
          label="Condition"
          value={value.condition}
          onChange={(e) => patch({ condition: e.currentTarget.value })}
        />
      </Group>

      <Select
        label="Stimulus type"
        data={['text', 'image', 'audio']}
        value={value.stimulus.type}
        onChange={(v) => patchStimulus({ type: v })}
      />
      {value.stimulus.type === 'text' ? (
        <TextInput
          label="Text content"
          value={value.stimulus.content ?? ''}
          onChange={(e) => patchStimulus({ content: e.currentTarget.value })}
        />
      ) : (
        <Group align="flex-end">
          <TextInput
            label="Asset URL"
            style={{ flex: 1 }}
            value={value.stimulus.url ?? ''}
            onChange={(e) => patchStimulus({ url: e.currentTarget.value })}
          />
          <Button variant="light" onClick={() => setPickerOpen(true)}>
            Pick from library
          </Button>
        </Group>
      )}

      <Group grow>
        <NumberInput
          label="Fixation duration (ms)"
          min={0}
          value={value.fixationDuration}
          onChange={(v) => patch({ fixationDuration: Number(v) || 0 })}
        />
        <NumberInput
          label="Duration (ms)"
          min={1}
          value={value.duration}
          onChange={(v) => patch({ duration: Number(v) || 1 })}
        />
      </Group>

      <Group grow>
        <TextInput
          label="Valid keys (comma-separated)"
          value={value.validKeys.join(',')}
          onChange={(e) =>
            patch({ validKeys: e.currentTarget.value.split(',').map((k) => k.trim()).filter(Boolean) })
          }
        />
        <TextInput
          label="Correct key"
          value={value.correctKey ?? ''}
          error={keyMismatch ? 'Correct key must be one of the valid keys' : null}
          onChange={(e) => patch({ correctKey: e.currentTarget.value || null })}
        />
      </Group>

      <Group grow>
        <NumberInput
          label="Timeout (ms, optional)"
          min={1}
          value={value.timeoutMs ?? ''}
          onChange={(v) => patch({ timeoutMs: v ? Number(v) : null })}
        />
        <NumberInput
          label="ITI (ms)"
          min={0}
          value={value.itiMs ?? 0}
          onChange={(v) => patch({ itiMs: Number(v) || 0 })}
        />
      </Group>

      <Group grow>
        <TextInput
          label="Feedback (correct)"
          value={value.feedback?.correct ?? ''}
          onChange={(e) => patchFeedback({ correct: e.currentTarget.value })}
        />
        <TextInput
          label="Feedback (incorrect)"
          value={value.feedback?.incorrect ?? ''}
          onChange={(e) => patchFeedback({ incorrect: e.currentTarget.value })}
        />
      </Group>

      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!!keyMismatch} onClick={() => onSave(value)}>
          Save trial
        </Button>
      </Group>

      <StimulusPicker
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(stimulus) => patchStimulus({ type: stimulus.type, url: stimulus.url })}
      />
    </Stack>
  )
}
