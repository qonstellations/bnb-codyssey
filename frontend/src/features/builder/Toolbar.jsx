import { useEffect, useState } from 'react'
import { ActionIcon, Button, Group, Menu, Modal, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useBuilderStore } from './store.js'
import { publishExperiment, updateExperiment } from '../../api/experiments.js'
import { TEMPLATES } from './templates.js'
import AiGenerateModal from './AiGenerateModal.jsx'
import JourneyModal from './JourneyModal.jsx'
import HowItWorksModal from './HowItWorksModal.jsx'

const AUTOSAVE_MS = 30000

export default function Toolbar({ experimentId, title, onTitleChange }) {
  const isDirty = useBuilderStore((s) => s.isDirty)
  const undo = useBuilderStore((s) => s.undo)
  const redo = useBuilderStore((s) => s.redo)
  const canUndo = useBuilderStore((s) => s.canUndo())
  const canRedo = useBuilderStore((s) => s.canRedo())
  const compile = useBuilderStore((s) => s.compile)
  const markSaved = useBuilderStore((s) => s.markSaved)
  const settings = useBuilderStore((s) => s.settings)
  const loadFromJson = useBuilderStore((s) => s.loadFromJson)
  const select = useBuilderStore((s) => s.select)

  // Returns compiled data, or null after showing errors (selecting the bad node).
  function compileOrNotify() {
    const { data, errors, warnings } = compile()
    if (!data) {
      const first = errors[0]
      if (first?.nodeId) select(first.nodeId)
      notifications.show({ color: 'red', message: first?.friendly ?? first?.message ?? 'Experiment is invalid' })
      return null
    }
    for (const warning of warnings ?? []) {
      notifications.show({ color: 'yellow', message: warning })
    }
    return data
  }

  const [saving, setSaving] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishResult, setPublishResult] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [journeyOpen, setJourneyOpen] = useState(false)
  const [howOpen, setHowOpen] = useState(false)

  async function save() {
    const data = compileOrNotify()
    if (!data) return
    setSaving(true)
    try {
      await updateExperiment(experimentId, { title, draft: data })
      markSaved()
      notifications.show({ message: 'Saved' })
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  // Autosave every 30s while dirty.
  useEffect(() => {
    const id = setInterval(() => {
      if (useBuilderStore.getState().isDirty) save()
    }, AUTOSAVE_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentId, title])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    function handler(e) {
      if (!useBuilderStore.getState().isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  function preview() {
    const data = compileOrNotify()
    if (!data) return
    sessionStorage.setItem('preview-experiment', JSON.stringify({ ...data, settings }))
    window.open('/run.html?preview=1', '_blank')
  }

  async function publish() {
    const data = compileOrNotify()
    if (!data) return
    setPublishing(true)
    try {
      await updateExperiment(experimentId, { title, draft: data })
      markSaved()
      const result = await publishExperiment(experimentId)
      setPublishResult(result)
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Publish failed' })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Group>
          <TextInput
            value={title}
            onChange={(e) => onTitleChange(e.currentTarget.value)}
            variant="unstyled"
            fw={600}
            size="lg"
          />
          <ActionIcon variant="subtle" disabled={!canUndo} onClick={undo} title="Undo">
            ↶
          </ActionIcon>
          <ActionIcon variant="subtle" disabled={!canRedo} onClick={redo} title="Redo">
            ↷
          </ActionIcon>
        </Group>
        <Group>
          <Button variant="subtle" onClick={() => setHowOpen(true)}>
            How it works
          </Button>
          <Button variant="light" onClick={() => setAiOpen(true)}>
            Generate with AI
          </Button>
          <Menu>
            <Menu.Target>
              <Button variant="subtle">Templates</Button>
            </Menu.Target>
            <Menu.Dropdown>
              {TEMPLATES.map((t) => (
                <Menu.Item key={t.id} onClick={() => loadFromJson(t.draft)}>
                  <Text size="sm">{t.label}</Text>
                  <Text size="xs" c="dimmed">
                    {t.blurb}
                  </Text>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Button variant="light" onClick={() => setJourneyOpen(true)}>
            Journey
          </Button>
          <Button variant="light" onClick={preview} title="See the experiment exactly as a participant would">
            Preview participant
          </Button>
          <Button variant="default" loading={saving} disabled={!isDirty} onClick={save}>
            {isDirty ? 'Save' : 'Saved ✓'}
          </Button>
          <Button onClick={() => setPublishOpen(true)}>Publish</Button>
        </Group>
      </Group>

      <AiGenerateModal opened={aiOpen} onClose={() => setAiOpen(false)} onTitleChange={onTitleChange} />
      <JourneyModal opened={journeyOpen} onClose={() => setJourneyOpen(false)} />
      <HowItWorksModal opened={howOpen} onClose={() => setHowOpen(false)} />

      <Modal
        opened={publishOpen}
        onClose={() => {
          setPublishOpen(false)
          setPublishResult(null)
        }}
        title="Publish experiment"
      >
        {!publishResult ? (
          <Stack>
            <Text size="sm">
              This saves your current draft and makes it live for participants at a public link.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPublishOpen(false)}>
                Cancel
              </Button>
              <Button loading={publishing} onClick={publish}>
                Publish
              </Button>
            </Group>
          </Stack>
        ) : (
          <Stack>
            <Text size="sm">Your experiment is live.</Text>
            <TextInput readOnly value={publishResult.participantUrl} />
            <Button
              onClick={() => {
                navigator.clipboard.writeText(publishResult.participantUrl)
                notifications.show({ message: 'Link copied' })
              }}
            >
              Copy link
            </Button>
          </Stack>
        )}
      </Modal>
    </>
  )
}
