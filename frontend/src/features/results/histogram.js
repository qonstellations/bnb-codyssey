const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]

function quantile(sorted, p) {
  return sorted[Math.round(p * (sorted.length - 1))]
}

/**
 * Frequency polygon data per group, as % of that group's values.
 * The window spans the 2nd–98th percentile, widened to sit symmetric around the
 * modal bin (clipped to [0, max]), so one extreme value can't squash the curve.
 * Values outside the window are dropped from the plot and counted in `hidden`.
 */
export function frequencyPolygon(groups, { bins = 30, max = Infinity } = {}) {
  const all = Object.values(groups).flat().filter(Number.isFinite).sort((a, b) => a - b)
  if (all.length < 2) return null

  let lo = quantile(all, 0.02)
  let hi = quantile(all, 0.98)
  if (hi - lo < 20) [lo, hi] = [Math.max(0, lo - 10), Math.min(max, hi + 10)] // near-identical values: give the curve room

  // Mode from a coarse pass over the robust range.
  const coarse = Array(20).fill(0)
  const cw = (hi - lo) / coarse.length || 1
  for (const x of all) if (x >= lo && x <= hi) coarse[Math.min(coarse.length - 1, Math.floor((x - lo) / cw))]++
  const mode = lo + (coarse.indexOf(Math.max(...coarse)) + 0.5) * cw

  const half = Math.max(mode - lo, hi - mode)
  const width = NICE_STEPS.find((s) => s >= (2 * half) / bins) ?? 10000
  const start = Math.max(0, Math.floor((mode - half) / width) * width)
  const end = Math.min(max, mode + half)
  const n = Math.max(1, Math.ceil((end - start) / width))

  const data = Array.from({ length: n }, (_, i) => ({ x: start + (i + 0.5) * width }))
  let hidden = 0
  for (const [group, values] of Object.entries(groups)) {
    const valid = values.filter(Number.isFinite)
    const counts = Array(n).fill(0)
    for (const x of valid) {
      let i = Math.floor((x - start) / width)
      if (i === n && x <= end) i-- // a value sitting exactly on the upper edge (e.g. 100%)
      if (i >= 0 && i < n) counts[i]++
      else hidden++
    }
    counts.forEach((c, i) => (data[i][group] = valid.length ? Math.round((c / valid.length) * 1000) / 10 : 0))
  }

  // Peak of the pooled curve, for the reference line.
  const pooled = data.map((row) => Object.keys(groups).reduce((s, k) => s + row[k], 0))
  const peak = data[pooled.indexOf(Math.max(...pooled))].x

  return { data, peak, width, hidden }
}
