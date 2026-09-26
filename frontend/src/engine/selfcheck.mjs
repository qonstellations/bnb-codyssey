// ponytail: smallest runnable check for the pure-logic engine modules (no DOM/AudioContext).
// Run with: node src/engine/selfcheck.mjs
import assert from 'node:assert'
import { createSeededRandom, shuffleWithMaxRepeats, buildBlockTrials } from './randomizer.js'
import { walkFlow } from './flow.js'
import { scoreTrial } from './score.js'

// Seeded random is reproducible.
const r1 = createSeededRandom(42)
const r2 = createSeededRandom(42)
assert.strictEqual(r1(), r2(), 'same seed must produce same sequence')

// Max-repeats rule holds after reshuffle.
const items = Array.from({ length: 10 }, (_, i) => ({ condition: i % 2 === 0 ? 'a' : 'b' }))
const shuffled = shuffleWithMaxRepeats(items, 2, { random: createSeededRandom(1) })
let run = 1
for (let i = 1; i < shuffled.length; i++) {
  run = shuffled[i].condition === shuffled[i - 1].condition ? run + 1 : 1
  assert.ok(run <= 2, 'maxRepeats violated')
}

// Block repetitions multiply trial count.
const block = { id: 'b1', trials: [{ id: 't1' }, { id: 't2' }], repetitions: 3, shuffle: false }
assert.strictEqual(buildBlockTrials(block).length, 6, 'repetitions should multiply trial count')

// Flow walks blocks in order with no branches/loops.
const experiment = {
  blocks: [{ id: 'b1', trials: [{}] }, { id: 'b2', trials: [{}] }],
  branches: [],
  loops: [],
}
const visited = [...walkFlow(experiment)].map((b) => b.id)
assert.deepStrictEqual(visited, ['b1', 'b2'], 'should walk blocks in order')

// Loop node repeats a block in place for its `repetitions` count.
const loopExperiment = {
  blocks: [{ id: 'b1', trials: [{}] }, { id: 'b2', trials: [{}] }],
  branches: [],
  loops: [{ id: 'l1', blockId: 'b1', repetitions: 3 }],
}
const loopVisits = [...walkFlow(loopExperiment)].map((b) => b.id)
assert.deepStrictEqual(loopVisits, ['b1', 'b1', 'b1', 'b2'], 'loop should repeat block in place')

// Branch guard: a self-targeting branch that always matches stops at maxSteps instead of hanging.
const branchLoopExperiment = {
  blocks: [{ id: 'b1', trials: [{}] }],
  branches: [{ id: 'br1', from: 'b1', to: 'b1', condition: { metric: 'accuracy', operator: '<', value: 1 } }],
  loops: [],
}
const branchVisits = [...walkFlow(branchLoopExperiment, { getMetrics: () => ({ accuracy: 0 }), maxSteps: 20 })]
assert.strictEqual(branchVisits.length, 20, 'branch guard should cap at maxSteps')

// Go/no-go: withholding on a correctKey-null trial is correct, pressing is wrong.
assert.strictEqual(scoreTrial({ withhold: true, correctKey: null }, null), true, 'withhold should be correct')
assert.strictEqual(scoreTrial({ withhold: true, correctKey: null }, { key: ' ' }), false, 'press on no-go should be wrong')
assert.strictEqual(scoreTrial({ correctKey: null }, { key: '3' }), null, 'rating trial (no correct key) is unscored')
assert.strictEqual(scoreTrial({ correctKey: 'f' }, null), null, 'timeout on keyed trial stays unscored')
assert.strictEqual(scoreTrial({ correctKey: 'f' }, { key: 'f' }), true)

console.log('engine selfcheck: all assertions passed')
