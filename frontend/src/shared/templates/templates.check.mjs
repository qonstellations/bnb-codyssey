// Self-check: node src/shared/templates/templates.check.mjs
import assert from 'node:assert/strict'
import { TEMPLATES, TEMPLATE_CATEGORIES } from './index.js'
import { validateExperiment } from '../experimentSchema.js'

assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length, 'template ids unique')
for (const t of TEMPLATES) {
  const { ok, errors } = validateExperiment(t.draft)
  assert.ok(ok, `${t.id}: ${errors.join('; ')}`)
  assert.ok(TEMPLATE_CATEGORIES.includes(t.category), `${t.id}: unknown category`)
  const ids = t.draft.blocks.flatMap((b) => b.trials.map((tr) => tr.id))
  assert.equal(new Set(ids).size, ids.length, `${t.id}: trial ids unique`)
  for (const tr of t.draft.blocks.flatMap((b) => b.trials)) {
    if (tr.correctKey != null) assert.ok(tr.validKeys.includes(tr.correctKey), `${t.id}/${tr.id}: correctKey not in validKeys`)
  }
  console.log(`${t.id.padEnd(14)} ${t.blocks} blocks  ${String(t.trials).padStart(3)} trials  ~${t.minutes} min`)
}

// 2-back targets really match 2 back.
const main = TEMPLATES.find((t) => t.id === '2-back').draft.blocks[1].trials
main.forEach((tr, i) => {
  const isMatch = i >= 2 && main[i - 2].stimulus.content === tr.stimulus.content
  assert.equal(tr.condition === 'target', isMatch, `2-back trial ${i}`)
})
console.log('templates ok')
