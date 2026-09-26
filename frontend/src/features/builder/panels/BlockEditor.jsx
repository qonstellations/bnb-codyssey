import { useState } from 'react'
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import RandomizationPanel from './RandomizationPanel.jsx'
import TrialForm from './TrialForm.jsx'

// "word,condition,correctKey" per line -> quick text trials, e.g. pasting a Stroop word list.
function parseBulkCsv(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [content = '', condition = '', correctKey = ''] = line.split(',').map((s) => s.trim())
      return {
        id: `trial_${Date.now()}_${i}_${Math.floor(Math.random() * 1e6)}`,
        stimulus: { type: 'text', content, url: null },
        duration: 2000,
        fixationDuration: 500,
        validKeys: correctKey ? [correctKey] : ['f', 'j'],
        correctKey: correctKey || null,
        condition: condition || content || `trial_${i + 1}`,
        feedback: { correct: '', incorrect: '' },
        timeoutMs: null,
        itiMs: 500,
      }
    })
}

export default function BlockEditor({ node, onChange }) {
  const { data } = node
  const trials = data.trials ?? []
  const [editingIndex, setEditingIndex] = useState(null) // number | 'new' | null
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')

  function setTrials(next) {
    onChange({ trials: next })
  }

  function saveTrial(trial) {
    if (editingIndex === 'new') setTrials([...trials, trial])
    else setTrials(trials.map((t, i) => (i === editingIndex ? trial : t)))
    setEditingIndex(null)
  }

  function duplicateTrial(i) {
    const copy = { ...trials[i], id: `trial_${Date.now()}_${Math.floor(Math.random() * 1e6)}` }
    setTrials([...trials.slice(0, i + 1), copy, ...trials.slice(i + 1)])
  }

  function deleteTrial(i) {
    setTrials(trials.filter((_, idx) => idx !== i))
  }

  return (
    <Stack gap="sm">
      <TextInput
        label="Block name"
        value={data.label ?? ''}
        onChange={(e) => onChange({ label: e.currentTarget.value })}
      />

      <RandomizationPanel block={data} onChange={onChange} />

      <Group justify="space-between">
        <Text size="xs" fw={700} c="dimmed">
          TRIALS ({trials.length})
        </Text>
        <Group gap="xs">
          <Button size="xs" variant="light" onClick={() => setBulkOpen(true)}>
            Bulk add
          </Button>
          <Button size="xs" onClick={() => setEditingIndex('new')}>
            Add trial
          </Button>
        </Group>
      </Group>

      <Table>
        <Table.Tbody>
          {trials.map((trial, i) => (
            <Table.Tr key={trial.id}>
              <Table.Td>{trial.condition || '(no condition)'}</Table.Td>
              <Table.Td>{trial.stimulus.content ?? trial.stimulus.url ?? ''}</Table.Td>
              <Table.Td>{trial.duration}ms</Table.Td>
              <Table.Td>
                <Group gap={4} justify="flex-end">
                  <ActionIcon size="sm" variant="subtle" onClick={() => setEditingIndex(i)}>
                    ✎
                  </ActionIcon>
                  <ActionIcon size="sm" variant="subtle" onClick={() => duplicateTrial(i)}>
                    ⧉
                  </ActionIcon>
                  <ActionIcon size="sm" variant="subtle" color="red" onClick={() => deleteTrial(i)}>
                    ✕
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal
        opened={editingIndex !== null}
        onClose={() => setEditingIndex(null)}
        title={editingIndex === 'new' ? 'Add trial' : 'Edit trial'}
        size="lg"
      >
        {editingIndex !== null && (
          <TrialForm
            trial={editingIndex === 'new' ? null : trials[editingIndex]}
            onSave={saveTrial}
            onCancel={() => setEditingIndex(null)}
          />
        )}
      </Modal>

      <Modal opened={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk add trials" size="md">
        <Stack>
          <Text size="xs" c="dimmed">
            One trial per line: content,condition,correctKey
          </Text>
          <Textarea
            minRows={6}
            value={bulkText}
            onChange={(e) => setBulkText(e.currentTarget.value)}
            placeholder={'RED,congruent,f\nBLUE,incongruent,j'}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTrials([...trials, ...parseBulkCsv(bulkText)])
                setBulkText('')
                setBulkOpen(false)
              }}
            >
              Add trials
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
