import { buildBlockTrials, createSeededRandom } from './randomizer.js'
import { walkFlow } from './flow.js'
import { scoreTrial } from './score.js'
import { blockMetrics, branchScore } from './index.js'

const FEEDBACK_MS = 600 // matches runTrial's feedback pause
const MAX_STEPS = 500 // walkFlow's default cycle guard

// Ex-Gaussian RT (normal + exponential tail), the usual shape of human reaction times.
function exGaussian(random, { mu, sigma, tau }) {
  const normal = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
  return Math.max(100, mu + sigma * normal - tau * Math.log(1 - random()))
}

// One synthetic response, shaped like runTrial's record. ponytail: no anticipatory
// ("too early") presses — add a fixation-press rate if dry runs need to exercise that path.
function simulateTrial(trial, random, { rt: rtModel, accuracy }) {
  const window = trial.timeoutMs ?? trial.duration
  const rt = exGaussian(random, rtModel)
  const accurate = random() < accuracy
  let key = null
  if (trial.withhold) key = accurate ? null : trial.validKeys[0]
  else if (trial.correctKey == null) key = trial.validKeys[0]
  else key = accurate ? trial.correctKey : (trial.validKeys.find((k) => k !== trial.correctKey) ?? '?')
  const responded = key != null && rt <= window ? { key } : null
  const correct = scoreTrial(trial, responded)

  const fb = trial.feedback && (trial.feedback.correct || trial.feedback.incorrect) ? FEEDBACK_MS : 0
  const durationMs =
    (trial.fixationDuration ?? 0) + (responded ? rt : Math.max(trial.duration, window)) + fb + (trial.itiMs ?? 0)
  return { record: { response: responded?.key ?? null, correct, rt: responded ? rt : null }, durationMs }
}

function quantile(sorted, q) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0
}

// Dry run of a compiled experiment with virtual participants: how long it takes, how often
// each block runs (retry branches show up as extra visits), and whether any path hits the
// cycle guard. Deterministic for a given seed.
// ponytail: no power estimate — synthetic data only echoes the assumed effect; add one when a
// researcher can enter an expected effect size.
export function simulate(
  experiment,
  { participants = 200, rt = { mu: 450, sigma: 50, tau: 100 }, accuracy = 0.9, seed = 1 } = {}
) {
  const random = createSeededRandom(seed)
  const loops = new Map(experiment.loops.map((l) => [l.blockId, l.repetitions]))
  const visits = new Map(experiment.blocks.map((b) => [b.id, 0]))
  const durations = []
  let repeated = 0
  let capped = 0

  for (let p = 0; p < participants; p++) {
    const results = new Map()
    const mine = new Map()
    let ms = 0
    let steps = 0
    const getMetrics = (block) => {
      const r = results.get(block.id)
      return r ? blockMetrics(r.trials, r.records, r.scores) : { accuracy: 0 }
    }
    for (const block of walkFlow(experiment, { getMetrics })) {
      steps++
      mine.set(block.id, (mine.get(block.id) ?? 0) + 1)
      const trials = buildBlockTrials(block, { random })
      const records = []
      const scores = []
      for (const trial of trials) {
        const { record, durationMs } = simulateTrial(trial, random, { rt, accuracy })
        ms += durationMs
        records.push(record)
        scores.push(branchScore(trial, record.correct, record.response))
      }
      results.set(block.id, { trials, records, scores })
    }
    for (const [id, n] of mine) visits.set(id, visits.get(id) + n)
    if ([...mine].some(([id, n]) => n > (loops.get(id) ?? 1))) repeated++
    if (steps >= MAX_STEPS) capped++
    durations.push(ms)
  }

  durations.sort((a, b) => a - b)
  return {
    participants,
    medianMs: quantile(durations, 0.5),
    p90Ms: quantile(durations, 0.9),
    blocks: experiment.blocks.map((b) => ({ id: b.id, label: b.label, meanVisits: visits.get(b.id) / participants })),
    repeatedShare: repeated / participants,
    cappedShare: capped / participants,
  }
}
