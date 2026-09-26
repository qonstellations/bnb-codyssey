import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, Group, Stack, Text, TextInput, Textarea, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  deleteExperiment,
  getExperiment,
  publishExperiment,
  updateExperiment,
} from '../api/experiments.js'
import LoadingScreen from '../components/LoadingScreen.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { openConfirmModal } from '../components/ConfirmModal.jsx'

export default function SettingsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState(null)
  const [title, setTitle] = useState('')
  const [consentText, setConsentText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getExperiment(id)
      .then(({ experiment: exp }) => {
        if (cancelled) return
        setExperiment(exp)
        setTitle(exp.title)
        setConsentText(exp.draft?.settings?.consentText ?? '')
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <LoadingScreen />
  if (error) return <ErrorState message={error.message} />

  async function save() {
    setSaving(true)
    try {
      const draft = { ...experiment.draft, settings: { ...experiment.draft.settings, consentText } }
      const { experiment: updated } = await updateExperiment(id, { title, draft })
      setExperiment(updated)
      notifications.show({ message: 'Saved' })
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(nextStatus) {
    setBusy(true)
    try {
      if (nextStatus === 'active') {
        const result = await publishExperiment(id)
        setExperiment((e) => ({ ...e, status: 'active', slug: result.slug }))
        notifications.show({ message: 'Published' })
      } else {
        const { experiment: updated } = await updateExperiment(id, { status: nextStatus })
        setExperiment(updated)
      }
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Action failed' })
    } finally {
      setBusy(false)
    }
  }

  function confirmDelete() {
    openConfirmModal({
      title: 'Delete this experiment?',
      message: 'This permanently deletes the experiment and all of its sessions and trials.',
      onConfirm: async () => {
        await deleteExperiment(id)
        navigate('/dashboard')
      },
    })
  }

  return (
    <Stack gap="lg" p="lg" maw={640}>
      <Group justify="space-between">
        <Title order={2}>Settings</Title>
        <Badge color={{ draft: 'gray', active: 'green', closed: 'red' }[experiment.status]}>
          {experiment.status}
        </Badge>
      </Group>

      <Card withBorder padding="lg">
        <Stack>
          <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          <Textarea
            label="Consent text"
            minRows={4}
            value={consentText}
            onChange={(e) => setConsentText(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button loading={saving} onClick={save}>
              Save
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg">
        <Stack>
          <Text fw={600}>Status</Text>
          <Group>
            {experiment.status !== 'active' && experiment.status !== 'closed' && (
              <Button loading={busy} onClick={() => toggleStatus('active')}>
                Publish
              </Button>
            )}
            {experiment.status === 'active' && (
              <Button color="red" variant="light" loading={busy} onClick={() => toggleStatus('closed')}>
                Close
              </Button>
            )}
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg" style={{ borderColor: 'var(--mantine-color-red-6)' }}>
        <Stack>
          <Text fw={600} c="red">
            Danger zone
          </Text>
          <Text size="sm" c="dimmed">
            Permanently delete this experiment and all collected data.
          </Text>
          <Group justify="flex-end">
            <Button color="red" onClick={confirmDelete}>
              Delete experiment
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  )
}
