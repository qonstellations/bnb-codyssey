import { useEffect, useRef, useState } from 'react'
import { ActionIcon, Button, Group, Menu, Modal, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useBuilderStore } from './store.js'
import { publishExperiment, updateExperiment } from '../../api/experiments.js'
import { createTemplate } from '../../api/templates.js'
import TemplateGallery from '../../components/TemplateGallery.jsx'
import { openConfirmModal } from '../../components/ConfirmModal.jsx'
import AiGenerateModal from './AiGenerateModal.jsx'

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
      notifications.show({ color: 'red', message: first?.message ?? 'Experiment is invalid' })
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
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [saveTpl, setSaveTpl] = useState(null) // { title, description, draft } while the save dialog is open
  const [savingTpl, setSavingTpl] = useState(false)

  // Replace the canvas with a template; confirm first if there's work on it.
  function applyTemplate(draft, name) {
    const load = () => {
      loadFromJson(draft, { dirty: true })
      onTitleChange(name)
      setGalleryOpen(false)
      notifications.show({ message: `Loaded "${name}" — save to keep it` })
    }
    const hasWork = useBuilderStore.getState().nodes.some((n) => n.type === 'block')
    if (!hasWork) return load()
    openConfirmModal({
      title: 'Replace current canvas?',
      message: 'The template will replace everything on the canvas.',
      confirmLabel: 'Replace',
      onConfirm: load,
    })
  }

  function openSaveTemplate() {
    const data = compileOrNotify()
    if (data) setSaveTpl({ title, description: '', draft: { ...data, settings } })
  }

  async function submitTemplate() {
    setSavingTpl(true)
    try {
      await createTemplate({ ...saveTpl, title: saveTpl.title.trim() })
      notifications.show({ message: 'Saved to My templates' })
      setSaveTpl(null)
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Could not save template' })
    } finally {
      setSavingTpl(false)
    }
  }

  // Title isn't part of the undo/dirty graph state — persist it on its own when edited.
  const savedTitle = useRef(title)
  async function saveTitle() {
    const next = title.trim() || 'Untitled Experiment'
    if (next !== title) onTitleChange(next)
    if (next === savedTitle.current) return
    try {
      await updateExperiment(experimentId, { title: next })
      savedTitle.current = next
      notifications.show({ message: 'Name saved' })
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Could not rename' })
    }
  }

  async function save() {
    const data = compileOrNotify()
    if (!data) return
    setSaving(true)
    try {
      await updateExperiment(experimentId, { title, draft: data })
      savedTitle.current = title
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
      savedTitle.current = title
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
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            maxLength={200}
            aria-label="Experiment name"
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
          <Button variant="light" onClick={() => setAiOpen(true)}>
            Generate with AI
          </Button>
          <Menu>
            <Menu.Target>
              <Button variant="subtle">Templates</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => setGalleryOpen(true)}>Browse templates…</Menu.Item>
              <Menu.Item onClick={openSaveTemplate}>Save current as template…</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button variant="light" onClick={preview}>
            Preview
          </Button>
          <Button variant="default" loading={saving} disabled={!isDirty} onClick={save}>
            {isDirty ? 'Save' : 'Saved ✓'}
          </Button>
          <Button onClick={() => setPublishOpen(true)}>Publish</Button>
        </Group>
      </Group>

      <AiGenerateModal opened={aiOpen} onClose={() => setAiOpen(false)} onTitleChange={onTitleChange} />

      <TemplateGallery opened={galleryOpen} onClose={() => setGalleryOpen(false)} onPick={applyTemplate} />

      <Modal opened={!!saveTpl} onClose={() => setSaveTpl(null)} title="Save as template">
        {saveTpl && (
          <Stack>
            <TextInput
              label="Name"
              value={saveTpl.title}
              maxLength={200}
              onChange={(e) => {
                const v = e.currentTarget.value
                setSaveTpl((t) => ({ ...t, title: v }))
              }}
            />
            <Textarea
              label="Description"
              placeholder="What is this design for?"
              maxLength={500}
              autosize
              minRows={2}
              value={saveTpl.description}
              onChange={(e) => {
                const v = e.currentTarget.value
                setSaveTpl((t) => ({ ...t, description: v }))
              }}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setSaveTpl(null)}>
                Cancel
              </Button>
              <Button loading={savingTpl} disabled={!saveTpl.title.trim()} onClick={submitTemplate}>
                Save template
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

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
