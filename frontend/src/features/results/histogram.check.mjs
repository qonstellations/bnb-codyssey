// node src/features/results/histogram.check.mjs
import assert from 'node:assert/strict'
import { frequencyPolygon } from './histogram.js'

// ~normal RTs around 450 ms plus two absurd outliers.
const rts = Array.from({ length: 400 }, (_, i) => 450 + 80 * Math.sin(i * 12.9898) * Math.cos(i * 78.233))
const h = frequencyPolygon({ a: [...rts, 9000, 12000], b: rts.map((x) => x + 60) })

const first = h.data[0].x, last = h.data.at(-1).x
assert.ok(last < 1500, `outliers must not stretch the axis (last bin ${last})`)
assert.ok(h.hidden >= 2, 'outliers are counted as hidden')
assert.ok(Math.abs((first + last) / 2 - h.peak) <= h.width * 3, 'window is centred near the peak')
for (const k of ['a', 'b']) {
  const total = h.data.reduce((s, r) => s + r[k], 0)
  assert.ok(total > 90 && total <= 100.5, `${k} percentages sum to ~100 (${total})`)
}

// Bounded scale (accuracy %): 100 is kept, the axis never passes max.
const acc = frequencyPolygon({ a: [100, 100, 95, 90, 100, 85, 100] }, { max: 100 })
assert.equal(acc.hidden, 0, '100% lands in the last bin, not off-scale')
assert.ok(acc.data.at(-1).x <= 100 + acc.width / 2, 'axis stops at max')

assert.equal(frequencyPolygon({ a: [300] }), null, 'too little data -> null')
assert.ok(frequencyPolygon({ a: [300, 300, 300] }).data.length > 1, 'identical values still produce a curve')
console.log('histogram ok')
