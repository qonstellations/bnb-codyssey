import { LineChart } from '@mantine/charts'
import { Text } from '@mantine/core'
import { frequencyPolygon } from './histogram.js'

// Fixed hue order; colour follows the group (sorted by name), never its rank.
const COLORS = ['indigo.6', 'orange.6', 'teal.6', 'pink.6', 'yellow.7', 'cyan.6', 'grape.6', 'lime.7']

/**
 * Thin-line frequency distribution, one curve per group.
 * `groups`: { name: number[] }. `unit` labels the x values ("ms", "%", "").
 * `of` names what the y-axis is a percentage of ("responses", "participants").
 */
export default function DistributionChart({ groups, unit = '', of, max, color }) {
  // ponytail: more than 8 groups get cut, fold into "other" if a template ever needs it.
  const names = Object.keys(groups)
    .filter((k) => groups[k].length)
    .sort()
    .slice(0, COLORS.length)
  const hist = frequencyPolygon(Object.fromEntries(names.map((k) => [k, groups[k]])), { max })

  if (!hist) return <Text c="dimmed">Not enough data yet.</Text>

  const fmt = (v) => `${Math.round(v)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`
  const half = hist.width / 2

  return (
    <>
      <LineChart
        h={220}
        data={hist.data}
        dataKey="x"
        series={names.map((k, i) => ({ name: k, color: color ?? COLORS[i] }))}
        curveType="monotone"
        strokeWidth={1.5}
        withDots={false}
        withLegend={names.length > 1}
        gridAxis="y"
        unit="%"
        xAxisProps={{ tickFormatter: (v) => Math.round(v), minTickGap: 24 }}
        referenceLines={[{ x: hist.peak, color: 'gray.5', label: `peak ${fmt(hist.peak)}`, strokeDasharray: '4 4' }]}
        tooltipProps={{ labelFormatter: (v) => `${fmt(Math.max(0, v - half))} – ${fmt(v + half)}` }}
      />
      <Text size="xs" c="dimmed" mt={4}>
        {hist.width}
        {unit && unit !== '%' ? ` ${unit}` : ' pt'} bins · % of {of}
        {hist.hidden > 0 && ` · ${hist.hidden} outlier${hist.hidden === 1 ? '' : 's'} off-scale`}
      </Text>
    </>
  )
}
