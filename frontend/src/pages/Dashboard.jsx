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
  updateExperiment,
} from '../api/experiments.js'
import { sampleStroop } from '../shared/sampleStroop.js'
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
    await navigator.clipboard.writeText(participantUrl(experiment.slug))
    notifications.show({ message: 'Participant link copied' })
  }

  function confirmDelete() {
    openConfirmModal({
      title: 'Delete experiment?',
      message: `This permanently deletes "${experiment.title}" and all of its sessions and trials.`,
      onConfirm: () => runAction(() => deleteExperiment(experiment._id)),
    })
  }

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>{experiment.title}</Text>
          <Badge color={STATUS_COLOR[experiment.status] ?? 'gray'}>{experiment.status}</Badge>
        </Group>
        <Text size="sm" c="dimmed">
          Edited {new Date(experiment.updatedAt).toLocaleDateString()}
        </Text>
        <Group justify="space-between" mt="sm">
          <Button
            variant="light"
            size="xs"
            onClick={() => navigate(`/experiments/${experiment._id}/edit`)}
          >
            Edit
          </Button>
          <Menu shadow="md" width={180} disabled={busy}>
            <Menu.Target>
              <Button variant="subtle" size="xs">
                More
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => navigate(`/experiments/${experiment._id}/edit`)}>
                Edit
              </Menu.Item>
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

  async function createAndEdit(draft) {
    setCreating(true)
    try {
      const { experiment } = await createExperiment(draft ? { draft } : {})
      navigate(`/experiments/${experiment._id}/edit`)
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Could not create experiment' })
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <LoadingScreen />
  if (error) return <ErrorState message={error.message} onRetry={reload} />

  return (
    <Stack gap="lg" p="lg">
      <Group justify="space-between">
        <Title order={2}>Experiments</Title>
        <Button onClick={() => createAndEdit()} loading={creating}>
          New experiment
        </Button>
      </Group>

      {data?.experiments.length === 0 ? (
        <EmptyState title="No experiments yet" message="Create one to get started.">
          <Group>
            <Button onClick={() => createAndEdit()} loading={creating}>
              Create your first experiment
            </Button>
            <Button variant="light" onClick={() => createAndEdit(sampleStroop)} loading={creating}>
              Start from Stroop template
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
