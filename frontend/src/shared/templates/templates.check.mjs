// Self-check: node src/shared/templates/templates.check.mjs
import assert from 'node:assert/strict'
import { TEMPLATES, TEMPLATE_LEVELS, composeFromTemplates } from './index.js'
import { validateExperiment } from '../experimentSchema.js'

assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length, 'template ids unique')
assert.equal(TEMPLATES.length, 6, '6 built-in templates')
for (const level of TEMPLATE_LEVELS) assert.equal(TEMPLATES.filter((t) => t.level === level).length, 3, `3 ${level} templates`)
for (const t of TEMPLATES) {
  const { ok, errors } = validateExperiment(t.draft)
  assert.ok(ok, `${t.id}: ${errors.join('; ')}`)
  assert.ok(t.measures, `${t.id}: measures`)
  const ids = t.draft.blocks.flatMap((b) => b.trials.map((tr) => tr.id))
  assert.equal(new Set(ids).size, ids.length, `${t.id}: trial ids unique`)
  for (const tr of t.draft.blocks.flatMap((b) => b.trials)) {
    if (tr.correctKey != null) assert.ok(tr.validKeys.includes(tr.correctKey), `${t.id}/${tr.id}: correctKey not in validKeys`)
  }
  assert.ok(t.seconds < 20, `${t.id}: ${t.seconds}s — default run must stay under 20 s`)
  console.log(`${t.id.padEnd(14)} ${t.blocks} blocks  ${String(t.trials).padStart(3)} trials  ~${t.seconds} s`)
}

// 2-back targets really match 2 back.
const main = TEMPLATES.find((t) => t.id === '2-back').draft.blocks[0].trials
main.forEach((tr, i) => {
  const isMatch = i >= 2 && main[i - 2].stimulus.content === tr.stimulus.content
  assert.equal(tr.condition === 'target', isMatch, `2-back trial ${i}`)
})
// The backend AI catalog mirrors this library (it deploys separately and can't import it).
const { TEMPLATE_CATALOG } = await import('../../../../backend/src/services/aiCatalog.js')
const { checkRecipe, FALLBACK_QUESTIONS } = await import('../../../../backend/src/services/groq.js')
assert.deepEqual(Object.keys(TEMPLATE_CATALOG).sort(), TEMPLATES.map((t) => t.id).sort(), 'AI catalog template ids')
for (const t of TEMPLATES) {
  assert.ok(t.example, `${t.id}: example prompt`)
  const blocks = Object.fromEntries(t.draft.blocks.map((b) => [b.id, b.trials.length]))
  assert.deepEqual(TEMPLATE_CATALOG[t.id].blocks, blocks, `${t.id}: AI catalog blocks/trial counts`)
  const retry = t.draft.branches[0]?.from ?? null
  assert.equal(TEMPLATE_CATALOG[t.id].retry, retry, `${t.id}: AI catalog retry branch`)
  const last = t.draft.blocks.at(-1).trials[0]
  assert.equal(TEMPLATE_CATALOG[t.id].responseMs, last.duration, `${t.id}: AI catalog responseMs`)
  if (TEMPLATE_CATALOG[t.id].fixationMs != null) {
    assert.equal(TEMPLATE_CATALOG[t.id].fixationMs, last.fixationDuration, `${t.id}: AI catalog fixationMs`)
  }

  // A recipe with no knobs reproduces the template exactly.
  const recipe = checkRecipe({
    steps: t.draft.blocks.map((b) => ({ id: b.id, task: t.id, block: b.id })),
    retries: t.draft.branches.map((br) => ({ step: br.from, below: br.condition.value })),
  })
  assert.ok(recipe.ok, `${t.id}: ${recipe.errors}`)
  assert.deepEqual(recipe.adjustments, [], `${t.id}: no clamps`)
  const composed = composeFromTemplates(recipe.data)
  // Trial ids are regenerated; everything else must match.
  const noIds = (blocks) => blocks.map((b) => ({ ...b, trials: b.trials.map(({ id, ...tr }) => tr) }))
  assert.deepEqual(noIds(composed.blocks), noIds(t.draft.blocks), `${t.id}: composed blocks equal the template`)
  assert.deepEqual(composed.settings, t.draft.settings, `${t.id}: composed settings`)
  assert.deepEqual(composed.branches, t.draft.branches, `${t.id}: composed retry branch`)
}

// Combining tasks with knobs: code does the trial arithmetic and applies overrides.
const combo = checkRecipe({
  steps: [
    { id: 's_p', task: 'stroop', block: 'practice' },
    { id: 's_m', task: 'stroop', block: 'main', trials: 60, responseMs: 1200, feedback: false },
    { id: 'g_m', task: 'go-nogo', block: 'main', trials: 30, fixationMs: 600 },
  ],
  retries: [{ step: 's_p', below: 80 }],
})
assert.ok(combo.ok, combo.errors.join('; '))
const comboDraft = composeFromTemplates(combo.data)
const v = validateExperiment(comboDraft)
assert.ok(v.ok, v.errors?.join('; '))
assert.equal(comboDraft.blocks[1].repetitions, 15, '60 trials / 4 unique')
assert.equal(comboDraft.blocks[2].repetitions, 4, '30 / 8 rounds to 4 (32 trials)')
assert.ok(comboDraft.blocks[1].trials.every((tr) => tr.duration === 1200 && !tr.feedback), 'responseMs + feedback off')
assert.ok(comboDraft.blocks[0].trials.every((tr) => tr.feedback), 'practice keeps feedback')
assert.ok(comboDraft.blocks[2].trials.every((tr) => tr.fixationDuration === 600), 'fixationMs')
assert.deepEqual(comboDraft.branches, [{ id: 'br_retry_s_p', from: 's_p', to: 's_p', condition: { metric: 'accuracy', operator: '<', value: 0.8 } }])
assert.equal(comboDraft.settings.fontSize, 48, 'min font of stroop (48) and go-nogo (72)')
assert.ok(comboDraft.settings.instructionsText.includes('INK COLOUR') && comboDraft.settings.instructionsText.includes('X'))

// Out-of-range knobs are clamped with a plain-English note, not rejected.
const clamped = checkRecipe({
  steps: [
    { id: 'a', task: 'simple-rt', block: 'main', responseMs: 20000, fixationMs: 100, trials: 9999 },
  ],
  retries: [{ step: 'a', below: 0.2 }],
})
assert.ok(clamped.ok)
assert.equal(clamped.data.steps[0].responseMs, 5000)
assert.equal(clamped.data.steps[0].trials, 500)
assert.equal(clamped.data.steps[0].fixationMs, undefined, 'simple-rt fixation not tunable')
assert.equal(clamped.data.retries[0].below, 0.5)
assert.equal(clamped.adjustments.length, 4, clamped.adjustments.join(' | '))
assert.ok(validateExperiment(composeFromTemplates(clamped.data)).ok, 'clamped recipe composes to a valid draft')

// Structural problems are rejected (and go to the repair loop).
assert.equal(checkRecipe({ steps: [{ task: 'flanker', block: 'main' }] }).ok, false)
assert.equal(checkRecipe({ steps: [{ task: 'stroop', block: 'mixed' }] }).ok, false)
assert.equal(checkRecipe({ steps: [{ id: 'a', task: 'stroop', block: 'main' }], retries: [{ step: 'zz', below: 0.7 }] }).ok, false)
assert.equal(checkRecipe({ steps: [] }).ok, false)
assert.equal(checkRecipe(null).ok, false)

// The question round always has something to show.
assert.ok(FALLBACK_QUESTIONS.length >= 1 && FALLBACK_QUESTIONS.every((q) => q.id && q.question && q.options.length >= 2))
console.log('templates ok')
