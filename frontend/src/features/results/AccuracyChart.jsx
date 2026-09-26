import { BarChart } from '@mantine/charts'
import { Text } from '@mantine/core'

export default function AccuracyChart({ conditionData }) {
  const data = Object.entries(conditionData ?? {})
    .filter(([, v]) => v.accuracy !== null)
    .map(([condition, v]) => ({ condition, accuracy: Math.round(v.accuracy * 100) }))

  if (data.length === 0) return <Text c="dimmed">Not enough data yet.</Text>

  return (
    <BarChart
      h={220}
      data={data}
      dataKey="condition"
      series={[{ name: 'accuracy', color: 'blue.6', label: 'Accuracy (%)' }]}
    />
  )
}
