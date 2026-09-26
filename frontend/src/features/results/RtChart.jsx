import { BarChart } from '@mantine/charts'
import { Text } from '@mantine/core'

export default function RtChart({ conditionData }) {
  const data = Object.entries(conditionData ?? {})
    .filter(([, v]) => v.meanRt !== null)
    .map(([condition, v]) => ({ condition, meanRt: Math.round(v.meanRt) }))

  if (data.length === 0) return <Text c="dimmed">Not enough data yet.</Text>

  return (
    <BarChart
      h={220}
      data={data}
      dataKey="condition"
      series={[{ name: 'meanRt', color: 'indigo.6', label: 'Mean RT (ms)' }]}
    />
  )
}
