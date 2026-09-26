import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionIcon, Button, Group, Menu, Modal, NumberInput, Stack, Table, Text, TextInput, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useBuilderStore } from './store.js'
import { publishExperiment, updateExperiment } from '../../api/experiments.js'
import { createTemplate } from '../../api/templates.js'
import TemplateGallery from '../../components/TemplateGallery.jsx'
import { openConfirmModal } from '../../components/ConfirmModal.jsx'
import HowItWorksModal from './HowItWorksModal.jsx'
import { copyText } from '../../shared/clipboard.js'
import GradientButton from '../../components/GradientButton.jsx'
import { simulate } from '../../engine/simulate.js'

const AUTOSAVE_MS = 30000

export default function Toolbar({ experimentId, title, onTitleChange }) {
  const navigate = useNavigate()
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
  const clearCanvas = useBuilderStore((s) => s.clearCanvas)
  const hasBlocks = useBuilderStore((s) => s.nodes.some((n) => n.type !== 'start' && n.type !== 'end'))

  function confirmClear() {
    openConfirmModal({
      title: 'Clear the canvas?',
      message: 'Every task, decision and repeat will be removed, leaving just Start → End. You can undo this.',
      confirmLabel: 'Clear canvas',
      onConfirm: clearCanvas,
    })
  }

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
  // Dry run: { data, rt, accuracy } while open.
  const [dryRun, setDryRun] = useState(null)
  const dryResult = dryRun && simulate(dryRun.data, { rt: { mu: dryRun.rt, sigma: 50, tau: 100 }, accuracy: dryRun.accuracy })
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishResult, setPublishResult] = useState(null)
  const [publishing, setPublishing] = useState(false)
  // First visit to the builder opens the guide once.
  const [howOpen, setHowOpen] = useState(() => {
    try {
      if (localStorage.getItem('hiw-seen')) return false
      localStorage.setItem('hiw-seen', '1')
      return true
    } catch {
      return false
    }
  })
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
    try {
      localStorage.setItem('preview-experiment', JSON.stringify({ ...data, settings }))
    } catch {
      notifications.show({ color: 'red', message: 'Could not store the preview (browser storage is blocked)' })
      return
    }
    window.open('/run.html?preview=1', '_blank')
  }

  function openDryRun() {
    const data = compileOrNotify()
    if (data) setDryRun({ data, rt: 450, accuracy: 0.9 })
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
      <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
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
          <Button variant="light" color="red" size="xs" disabled={!hasBlocks} onClick={confirmClear}>
            Clear
          </Button>
        </Group>
        <Group>
          <Button variant="default" onClick={() => setHowOpen(true)}>
            How it works
          </Button>
          {/* TODO(enhance-ai): wire this up to an AI pass over the *current* canvas — e.g.
              suggest missing blocks, retry rules, or fixes. "Generate with AI" (a fresh
              experiment from a text prompt) moved to the Dashboard; this is intentionally a
              different, not-yet-built feature. */}
          <GradientButton variant="variant" disabled title="Coming soon">
            Enhance with AI
          </GradientButton>
          <Menu>
            <Menu.Target>
              <Button variant="default">Templates</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => setGalleryOpen(true)}>Browse templates…</Menu.Item>
              <Menu.Item onClick={openSaveTemplate}>Save current as template…</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button variant="default" onClick={preview} title="See the experiment exactly as a participant would">
            Preview
          </Button>
          <Button variant="default" onClick={openDryRun} title="Run 200 virtual participants through this design">
            Dry run
          </Button>
          <Button variant="default" loading={saving} disabled={!isDirty} onClick={save}>
            {isDirty ? 'Save' : 'Saved ✓'}
          </Button>
          <Button onClick={() => setPublishOpen(true)}>Publish</Button>
        </Group>
      </Group>

      <HowItWorksModal
        opened={howOpen}
        onClose={() => setHowOpen(false)}
        onOpenTemplates={() => {
          setHowOpen(false)
          setGalleryOpen(true)
        }}
        onOpenAi={() => {
          setHowOpen(false)
          navigate('/dashboard')
        }}
        onPreview={() => {
          setHowOpen(false)
          preview()
        }}
      />

      <TemplateGallery opened={galleryOpen} onClose={() => setGalleryOpen(false)} onPick={applyTemplate} />

      <Modal opened={!!dryRun} onClose={() => setDryRun(null)} title="Dry run — 200 virtual participants" size="lg">
        {dryResult && (
          <Stack>
            <Group grow>
              <NumberInput
                label="Typical response time (ms)"
                min={150}
                max={3000}
                step={50}
                value={dryRun.rt}
                onChange={(v) => setDryRun((d) => ({ ...d, rt: Number(v) || 450 }))}
              />
              <NumberInput
                label="Accuracy (%)"
                min={0}
                max={100}
                step={5}
                value={Math.round(dryRun.accuracy * 100)}
                onChange={(v) => setDryRun((d) => ({ ...d, accuracy: Math.min(100, Math.max(0, Number(v) || 0)) / 100 }))}
              />
            </Group>
            <Text>
              Takes about <b>{Math.round(dryResult.medianMs / 1000)} s</b> (9 in 10 finish within{' '}
              {Math.round(dryResult.p90Ms / 1000)} s), not counting consent, instructions and breaks.
            </Text>
            {dryResult.repeatedShare > 0 && (
              <Text>
                {Math.round(dryResult.repeatedShare * 100)}% of participants repeat a block because of a decision rule.
              </Text>
            )}
            {dryResult.cappedShare > 0 && (
              <Text c="red">
                {Math.round(dryResult.cappedShare * 100)}% hit the 500-step safety limit — check for a loop that never exits.
              </Text>
            )}
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Block</Table.Th>
                  <Table.Th>Average runs per participant</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dryResult.blocks.map((b) => (
                  <Table.Tr key={b.id}>
                    <Table.Td>{b.label}</Table.Td>
                    <Table.Td>{b.meanVisits.toFixed(2)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Text size="xs" c="dimmed">
              Responses are simulated, so this checks the design's length and decision rules, not real behaviour.
            </Text>
          </Stack>
        )}
      </Modal>

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
              onClick={async () => {
                const ok = await copyText(publishResult.participantUrl)
                notifications.show({
                  color: ok ? undefined : 'yellow',
                  message: ok ? 'Link copied' : "Couldn't copy automatically — select the link above",
                })
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
