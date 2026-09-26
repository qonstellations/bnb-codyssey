import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Anchor, Badge, Button, Card, Center, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useApi } from '../hooks/useApi.js'
import { getSummary, getSessions } from '../api/results.js'
import { getExperiment } from '../api/experiments.js'
import { copyText } from '../shared/clipboard.js'
import LoadingScreen from '../components/LoadingScreen.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import SummaryCards from '../features/results/SummaryCards.jsx'
import DistributionChart from '../features/results/DistributionChart.jsx'
import ParticipantTable from '../features/results/ParticipantTable.jsx'
import ExportButton from '../features/results/ExportButton.jsx'
import { useConditionAggregates } from '../features/results/useConditionAggregates.js'

const STATUS_COLOR = { draft: 'gray', active: 'green', closed: 'red' }

// { condition: { rts, accuracies } } -> { condition: values[] }
const pick = (data, field) => Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [k, v[field]]))

function ChartCard({ title, caption, loading, children }) {
  return (
    <Card withBorder padding="lg" radius="md">
      <Title order={5}>{title}</Title>
      <Text size="xs" c="dimmed" mb="md">
        {caption}
      </Text>
      {loading ? (
        <Center h={220}>
          <Loader size="sm" />
        </Center>
      ) : (
        children
      )}
    </Card>
  )
}

export default function ResultsPage() {
  const { id } = useParams()
  const expApi = useApi(() => getExperiment(id))
  const summaryApi = useApi(() => getSummary(id))
  const sessionsApi = useApi(() => getSessions(id))
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [refreshing, setRefreshing] = useState(false)

  const sessions = sessionsApi.data?.sessions ?? []
  const aggregates = useConditionAggregates(id, sessions)

  // No polling: data changes only when participants finish, so the researcher refreshes on demand.
  async function refresh() {
    setRefreshing(true)
    try {
      await Promise.all([summaryApi.reload(), sessionsApi.reload()])
      setUpdatedAt(new Date())
    } catch (err) {
      notifications.show({ color: 'red', message: err.message ?? 'Refresh failed' })
    } finally {
      setRefreshing(false)
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/run/${experiment.slug}`
    const ok = await copyText(url)
    notifications.show({
      color: ok ? undefined : 'yellow',
      message: ok ? 'Participant link copied' : `Couldn't copy automatically: ${url}`,
    })
  }

  if (summaryApi.loading || sessionsApi.loading) return <LoadingScreen />
  if (summaryApi.error) return <ErrorState message={summaryApi.error.message} onRetry={summaryApi.reload} />
  if (sessionsApi.error) return <ErrorState message={sessionsApi.error.message} onRetry={sessionsApi.reload} />

  const experiment = expApi.data?.experiment
  const summary = summaryApi.data.summary
  const hasClean = sessions.some((s) => s.status === 'completed' && !s.excluded)

  return (
    <Stack gap="lg" p="lg">
      <div>
        <Anchor component={Link} to="/dashboard" size="sm" c="dimmed">
          ← Experiments
        </Anchor>
        <Group justify="space-between" align="flex-end" mt="xs" wrap="wrap">
          <div>
            <Group gap="sm">
              <Title order={1} style={{ letterSpacing: '-0.04em' }}>
                {experiment?.title ?? 'Results'}
              </Title>
              {experiment && (
                <Badge color={STATUS_COLOR[experiment.status] ?? 'gray'} variant="light">
                  {experiment.status}
                </Badge>
              )}
            </Group>
            <Text c="dimmed" mt={6}>
              Results · {sessions.length} participant{sessions.length === 1 ? '' : 's'} · updated{' '}
              {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </div>
          <Group>
            {experiment?.status === 'active' && experiment.slug && (
              <Button variant="subtle" onClick={copyLink}>
                Copy participant link
              </Button>
            )}
            <Button variant="default" onClick={refresh} loading={refreshing}>
              Refresh
            </Button>
            {sessions.length > 0 && <ExportButton expId={id} />}
          </Group>
        </Group>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No participants yet"
          message="Share your participant link, then hit Refresh once people have taken part."
        />
      ) : (
        <>
          <SummaryCards summary={summary} hasClean={hasClean} />

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <ChartCard title="RT distribution by condition" caption="Every response · completed, included sessions" loading={aggregates.loading}>
              <DistributionChart groups={pick(aggregates.data, 'rts')} unit="ms" of="responses" />
            </ChartCard>
            <ChartCard title="Accuracy distribution by condition" caption="One value per participant · completed, included sessions" loading={aggregates.loading}>
              <DistributionChart groups={pick(aggregates.data, 'accuracies')} unit="%" of="participants" max={100} />
            </ChartCard>
            <ChartCard
              title="Timing quality distribution"
              caption={`Calibration score per session, 0–100${hasClean ? ` · mean ${Math.round(summary.meanTimingScore)}` : ''}`}
            >
              <DistributionChart
                groups={{ Sessions: sessions.map((s) => s.calibration?.score).filter((v) => typeof v === 'number') }}
                of="sessions"
                max={100}
                color="grape.6"
              />
            </ChartCard>
          </SimpleGrid>

          <ParticipantTable expId={id} sessions={sessions} onChanged={refresh} />
        </>
      )}
    </Stack>
  )
}
