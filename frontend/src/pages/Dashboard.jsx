import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Group, Menu, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useApi } from '../hooks/useApi.js'
import {
  createExperiment,
  deleteExperiment,
  duplicateExperiment,
  listExperiments,
  publishExperiment,
  updateExperiment,
} from '../api/experiments.js'
import { copyText } from '../shared/clipboard.js'
import TemplateGallery from '../components/TemplateGallery.jsx'
import AiGenerateModal from '../features/builder/AiGenerateModal.jsx'
import GradientButton from '../components/GradientButton.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { openConfirmModal } from '../components/ConfirmModal.jsx'

const STATUS_COLOR = { draft: 'gray', active: 'green', closed: 'red' }

function participantUrl(slug) {
  return `${window.location.origin}/run/${slug}`
}

function ExperimentCard({ experiment, onChanged }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function runAction(fn) {
    setBusy(true)
    try {
      await fn()
      onChanged()
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Action failed' })
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    const ok = await copyText(participantUrl(experiment.slug))
    notifications.show({
      color: ok ? undefined : 'yellow',
      message: ok ? 'Participant link copied' : "Couldn't copy automatically — link is above, copy it manually",
    })
  }

  function confirmPublish() {
    openConfirmModal({
      title: 'Publish experiment?',
      message: `"${experiment.title}" goes live with its last saved draft at a public participant link.`,
      confirmLabel: 'Publish',
      confirmColor: 'blue',
      onConfirm: () =>
        runAction(async () => {
          const { participantUrl } = await publishExperiment(experiment._id)
          notifications.show({ color: 'green', title: 'Published', message: participantUrl })
        }),
    })
  }

  function confirmDelete() {
    openConfirmModal({
      title: 'Delete experiment?',
      message: `This permanently deletes "${experiment.title}" and all of its sessions and trials.`,
      onConfirm: () => runAction(() => deleteExperiment(experiment._id)),
    })
  }

  return (
    <Card padding="xl" className="ag-hover-card">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={500} size="lg" style={{ letterSpacing: '-0.01em' }}>
            {experiment.title}
          </Text>
          <Badge color={STATUS_COLOR[experiment.status] ?? 'gray'}>{experiment.status}</Badge>
        </Group>
        <Text size="sm" c="dimmed">
          Edited {new Date(experiment.updatedAt).toLocaleDateString()}
        </Text>
        <Group justify="space-between" mt="sm">
          <Button
            size="xs"
            onClick={() => navigate(`/experiments/${experiment._id}/edit`)}
          >
            Edit
          </Button>
          <Menu shadow="md" width={180} disabled={busy}>
            <Menu.Target>
              <Button variant="default" size="xs">
                More
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {experiment.status !== 'active' && (
                <Menu.Item color="blue" fw={500} onClick={confirmPublish}>Publish</Menu.Item>
              )}
              <Menu.Item onClick={() => navigate(`/experiments/${experiment._id}/results`)}>
                Results
              </Menu.Item>
              <Menu.Item onClick={() => runAction(() => duplicateExperiment(experiment._id))}>
                Duplicate
              </Menu.Item>
              {experiment.status !== 'closed' && (
                <Menu.Item
                  onClick={() =>
                    runAction(() => updateExperiment(experiment._id, { status: 'closed' }))
                  }
                >
                  Close
                </Menu.Item>
              )}
              {experiment.status === 'active' && (
                <Menu.Item onClick={copyLink}>Copy participant link</Menu.Item>
              )}
              <Menu.Item color="red" onClick={confirmDelete}>
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Stack>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useApi(listExperiments)
  const [creating, setCreating] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  async function createAndEdit(draft, title) {
    setCreating(true)
    try {
      const { experiment } = await createExperiment(draft ? { draft, title } : {})
      navigate(`/experiments/${experiment._id}/edit`)
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Could not create experiment' })
    } finally {
      setCreating(false)
    }
  }

  // Uncaught on purpose: AiGenerateModal's own try/catch turns a throw here into its error list,
  // so the modal stays open and shows why instead of silently closing on failure.
  async function onAiGenerated(draft, title, notes) {
    const { experiment } = await createExperiment({ draft, title })
    if (notes?.length) {
      notifications.show({
        title: 'Experiment generated — review it on the canvas',
        message: notes.map((n) => `• ${n}`).join('\n'),
        autoClose: 12000,
        style: { whiteSpace: 'pre-line' },
      })
    }
    navigate(`/experiments/${experiment._id}/edit`)
  }

  if (loading) return <LoadingScreen />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <Stack gap="lg" p="lg">
      <Group justify="space-between" align="flex-end" mt="lg" mb="md">
        <div>
          <Title order={1} style={{ letterSpacing: '-0.04em' }}>
            Experiments
          </Title>
          <Text c="dimmed" mt={6}>
            Build, publish and track your studies.
          </Text>
        </div>
        <Group>
          <GradientButton onClick={() => setAiOpen(true)}>Generate with AI</GradientButton>
          <Button size="md" variant="default" onClick={() => setGalleryOpen(true)}>
            New from template
          </Button>
          <Button size="md" onClick={() => createAndEdit()} loading={creating}>
            New experiment
          </Button>
        </Group>
      </Group>

      <TemplateGallery
        opened={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onPick={(draft, title) => createAndEdit(draft, title)}
      />

      <AiGenerateModal opened={aiOpen} onClose={() => setAiOpen(false)} onGenerated={onAiGenerated} />

      {data?.experiments.length === 0 ? (
        <EmptyState title="No experiments yet" message="Create one to get started.">
          <Group>
            <Button onClick={() => createAndEdit()} loading={creating}>
              Create your first experiment
            </Button>
            <Button size="md" variant="default" onClick={() => setGalleryOpen(true)}>
              Start from a template
            </Button>
          </Group>
        </EmptyState>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {data.experiments.map((experiment) => (
            <ExperimentCard key={experiment._id} experiment={experiment} onChanged={reload} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}
