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
const { checkRecipe } = await import('../../../../backend/src/services/groq.js')
assert.deepEqual(Object.keys(TEMPLATE_CATALOG).sort(), TEMPLATES.map((t) => t.id).sort(), 'AI catalog template ids')
for (const t of TEMPLATES) {
  assert.ok(t.example, `${t.id}: example prompt`)
  const blocks = Object.fromEntries(t.draft.blocks.map((b) => [b.id, b.trials.length]))
  assert.deepEqual(TEMPLATE_CATALOG[t.id].blocks, blocks, `${t.id}: AI catalog blocks/trial counts`)
  const retry = t.draft.branches[0]?.from ?? null
  assert.equal(TEMPLATE_CATALOG[t.id].retry, retry, `${t.id}: AI catalog retry branch`)

  // A recipe that reproduces the template composes to the same trials.
  const recipe = checkRecipe({
    blocks: t.draft.blocks.map((b) => ({ id: b.id, template: t.id, block: b.id })),
    branches: t.draft.branches.map((br) => ({ from: br.from, to: br.to, ...br.condition })),
    loops: [],
  })
  assert.ok(recipe.ok, `${t.id}: ${recipe.errors}`)
  const composed = composeFromTemplates(recipe.data)
  // Trial ids are regenerated; everything else must match.
  const noIds = (blocks) => blocks.map((b) => ({ ...b, trials: b.trials.map(({ id, ...tr }) => tr) }))
  assert.deepEqual(noIds(composed.blocks), noIds(t.draft.blocks), `${t.id}: composed blocks equal the template`)
  assert.deepEqual(composed.settings, t.draft.settings, `${t.id}: composed settings`)
}

// Combining two tasks validates; bad recipes are rejected.
const combo = checkRecipe({
  blocks: [
    { id: 's_p', template: 'stroop', block: 'practice' },
    { id: 's_m', template: 'stroop', block: 'main', repetitions: 3 },
    { id: 'g_m', template: 'go-nogo', block: 'main' },
  ],
  branches: [{ from: 's_p', to: 's_p', metric: 'accuracy', operator: '<', value: 0.8 }],
  loops: [{ blockId: 'g_m', repetitions: 2 }],
})
assert.ok(combo.ok, combo.errors.join('; '))
const comboDraft = composeFromTemplates(combo.data)
const v = validateExperiment(comboDraft)
assert.ok(v.ok, v.errors?.join('; '))
assert.equal(comboDraft.blocks[1].repetitions, 3)
assert.ok(comboDraft.settings.instructionsText.includes('INK COLOUR') && comboDraft.settings.instructionsText.includes('X'))
assert.equal(checkRecipe({ blocks: [{ template: 'flanker', block: 'main' }] }).ok, false)
assert.equal(checkRecipe({ blocks: [{ template: 'stroop', block: 'mixed' }] }).ok, false)
assert.equal(checkRecipe({ blocks: [{ id: 'a', template: 'stroop', block: 'main' }], branches: [{ from: 'a', to: 'zz', metric: 'accuracy', operator: '<', value: 1 }] }).ok, false)
assert.equal(checkRecipe(null).ok, false)
console.log('templates ok')
