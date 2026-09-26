import { Card, SimpleGrid, Text } from '@mantine/core'

function Stat({ label, value }) {
  return (
    <Card withBorder padding="md" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {value}
      </Text>
    </Card>
  )
}

export default function SummaryCards({ summary }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
      <Stat label="Total" value={summary.totalSessions} />
      <Stat label="Completed" value={summary.completed} />
      <Stat label="Abandoned" value={summary.abandoned} />
      <Stat label="Excluded" value={summary.excluded} />
      <Stat label="Completion rate" value={`${Math.round(summary.completionRate * 100)}%`} />
      <Stat label="Mean RT" value={`${Math.round(summary.meanRt)}ms`} />
      <Stat label="Accuracy" value={`${Math.round(summary.accuracy * 100)}%`} />
      <Stat label="Mean timing score" value={Math.round(summary.meanTimingScore)} />
    </SimpleGrid>
  )
}
