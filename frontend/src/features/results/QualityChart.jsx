import { BarChart } from '@mantine/charts'
import { Text } from '@mantine/core'

const BUCKETS = ['0-20', '20-40', '40-60', '60-80', '80-100']

export default function QualityChart({ sessions }) {
  if (!sessions || sessions.length === 0) return <Text c="dimmed">No sessions yet.</Text>

  const counts = BUCKETS.map(() => 0)
  for (const session of sessions) {
    const score = session.calibration?.score
    if (typeof score !== 'number') continue
    const bucket = Math.min(Math.floor(score / 20), BUCKETS.length - 1)
    counts[bucket] += 1
  }

  const data = BUCKETS.map((label, i) => ({ bucket: label, sessions: counts[i] }))

  return (
    <BarChart
      h={220}
      data={data}
      dataKey="bucket"
      series={[{ name: 'sessions', color: 'grape.6', label: 'Sessions' }]}
    />
  )
}
