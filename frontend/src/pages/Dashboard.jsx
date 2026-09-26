import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
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

const STATUS_COLOR = { draft: 'gray', active: 'green', closed: 'red' }

function participantUrl(slug) {
  return `${window.location.origin}/run/${slug}`
}

function ExperimentCard({ experiment, onChanged }) {
  const navigate = useNavigate()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
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
              <Menu.Item color="red" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Stack>

      <Modal
        opened={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete experiment?"
      >
        <Text size="sm" mb="md">
          This permanently deletes "{experiment.title}" and all of its sessions and trials.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={busy}
            onClick={() =>
              runAction(() => deleteExperiment(experiment._id)).finally(() =>
                setConfirmingDelete(false)
              )
            }
          >
            Delete
          </Button>
        </Group>
      </Modal>
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

  return (
    <Stack gap="lg" p="lg">
      <Group justify="space-between">
        <Title order={2}>Experiments</Title>
        <Button onClick={() => createAndEdit()} loading={creating}>
          New experiment
        </Button>
      </Group>

      {loading && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={140} radius="md" />
          ))}
        </SimpleGrid>
      )}

      {!loading && error && (
        <Alert color="red" title="Could not load experiments">
          <Stack gap="sm">
            <Text size="sm">{error.message}</Text>
            <Button size="xs" variant="light" onClick={reload}>
              Retry
            </Button>
          </Stack>
        </Alert>
      )}

      {!loading && !error && data?.experiments.length === 0 && (
        <Stack align="center" gap="sm" py="xl">
          <Text c="dimmed">No experiments yet.</Text>
          <Group>
            <Button onClick={() => createAndEdit()} loading={creating}>
              Create your first experiment
            </Button>
            <Button
              variant="light"
              onClick={() => createAndEdit(sampleStroop)}
              loading={creating}
            >
              Start from Stroop template
            </Button>
          </Group>
        </Stack>
      )}

      {!loading && !error && data?.experiments.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {data.experiments.map((experiment) => (
            <ExperimentCard key={experiment._id} experiment={experiment} onChanged={reload} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}
