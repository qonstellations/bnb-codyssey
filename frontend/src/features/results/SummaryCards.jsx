import { Card, Progress, SimpleGrid, Text } from '@mantine/core'

function Stat({ label, value, hint, children }) {
  return (
    <Card withBorder padding="lg" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: '0.04em' }}>
        {label}
      </Text>
      <Text fw={700} mt={4} style={{ fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
        {value}
      </Text>
      {children}
      {hint && (
        <Text size="xs" c="dimmed" mt={6}>
          {hint}
        </Text>
      )}
    </Card>
  )
}

// `hasClean`: the backend reports 0 (not null) for RT/accuracy when no completed,
// included session exists — show a dash instead of a fake "0ms".
export default function SummaryCards({ summary, hasClean }) {
  const pct = Math.round(summary.completionRate * 100)
  return (
    <SimpleGrid cols={{ base: 2, md: 4 }}>
      <Stat
        label="Participants"
        value={summary.totalSessions}
        hint={`${summary.completed} completed · ${summary.abandoned} abandoned · ${summary.excluded} excluded`}
      />
      <Stat label="Completion rate" value={`${pct}%`}>
        <Progress value={pct} size="sm" mt={8} radius="xl" />
      </Stat>
      <Stat
        label="Mean RT"
        value={hasClean ? `${Math.round(summary.meanRt)} ms` : '—'}
        hint="Completed, included sessions"
      />
      <Stat
        label="Accuracy"
        value={hasClean ? `${Math.round(summary.accuracy * 100)}%` : '—'}
        hint="Completed, included sessions"
      />
    </SimpleGrid>
  )
}
