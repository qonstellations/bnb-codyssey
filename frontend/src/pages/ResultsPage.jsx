import { useParams } from 'react-router-dom'
import { Badge, Card, Group, SimpleGrid, Stack, Title } from '@mantine/core'
import { useApi } from '../hooks/useApi.js'
import { usePolling } from '../hooks/usePolling.js'
import { getSummary, getSessions } from '../api/results.js'
import LoadingScreen from '../components/LoadingScreen.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import SummaryCards from '../features/results/SummaryCards.jsx'
import RtChart from '../features/results/RtChart.jsx'
import AccuracyChart from '../features/results/AccuracyChart.jsx'
import QualityChart from '../features/results/QualityChart.jsx'
import ParticipantTable from '../features/results/ParticipantTable.jsx'
import ExportButton from '../features/results/ExportButton.jsx'
import { useConditionAggregates } from '../features/results/useConditionAggregates.js'

const POLL_MS = 5000

export default function ResultsPage() {
  const { id } = useParams()
  const summaryApi = useApi(() => getSummary(id), { immediate: true })
  const sessionsApi = useApi(() => getSessions(id), { immediate: true })

  usePolling(() => Promise.all([summaryApi.reload(), sessionsApi.reload()]), POLL_MS)

  const sessions = sessionsApi.data?.sessions ?? []
  const { data: conditionData } = useConditionAggregates(id, sessions)

  if (summaryApi.loading || sessionsApi.loading) return <LoadingScreen />
  if (summaryApi.error) return <ErrorState message={summaryApi.error.message} onRetry={summaryApi.reload} />
  if (sessionsApi.error) return <ErrorState message={sessionsApi.error.message} onRetry={sessionsApi.reload} />

  if (sessions.length === 0) {
    return (
      <Stack p="lg">
        <EmptyState
          title="No participants yet"
          message="Share your participant link to start collecting data."
        />
      </Stack>
    )
  }

  return (
    <Stack gap="lg" p="lg">
      <Group justify="space-between">
        <Group>
          <Title order={1} style={{ letterSpacing: '-0.04em' }}>Results</Title>
          <Badge color="green" variant="light">
            Live
          </Badge>
        </Group>
        <ExportButton expId={id} />
      </Group>

      <SummaryCards summary={summaryApi.data.summary} />

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Card withBorder>
          <Title order={5} mb="sm">
            Mean RT by condition
          </Title>
          <RtChart conditionData={conditionData} />
        </Card>
        <Card withBorder>
          <Title order={5} mb="sm">
            Accuracy by condition
          </Title>
          <AccuracyChart conditionData={conditionData} />
        </Card>
        <Card withBorder>
          <Title order={5} mb="sm">
            Timing quality distribution
          </Title>
          <QualityChart sessions={sessions} />
        </Card>
      </SimpleGrid>

      <ParticipantTable expId={id} sessions={sessions} onChanged={sessionsApi.reload} />
    </Stack>
  )
}
