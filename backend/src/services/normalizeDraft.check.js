// Self-check: node src/services/normalizeDraft.check.js
import assert from 'node:assert/strict';
import { normalizeDraft, componentIssues } from './normalizeDraft.js';
import { experimentSchema } from '../validators/experimentSchema.js';

const sloppy = {
  settings: { consentText: '' },
  blocks: [
    { label: 'Practice', trials: [{ stimulus: 'RED', duration: 999999, validKeys: ['F', 'Space'], correctKey: 'space' }] },
    { id: 'b1', trials: [{ id: 't', stimulus: { type: 'image' }, validKeys: [] }, { id: 't' }] },
  ],
  branches: [
    { from: 'b1', to: 'b1', condition: { metric: 'accuracy', operator: '<', value: 0.7 } },
    { from: 'b1', to: 'nope', condition: { metric: 'accuracy', operator: '<', value: 0.7 } },
  ],
  loops: [{ blockId: 'b1', repetitions: 1 }, { blockId: 'ghost', repetitions: 3 }],
};

const out = normalizeDraft(sloppy);
const res = experimentSchema.safeParse(out);
assert.ok(res.success, JSON.stringify(res.error?.issues));
assert.equal(out.branches.length, 1);
assert.equal(out.loops.length, 1);
assert.equal(out.loops[0].repetitions, 2);
assert.equal(out.blocks[0].trials[0].duration, 60000);
assert.deepEqual(out.blocks[0].trials[0].validKeys, ['f', ' ']);
assert.equal(out.blocks[0].trials[0].correctKey, ' ');
assert.equal(out.blocks[1].trials[0].stimulus.type, 'text');
// wrong correctKey is kept (not nulled) so the schema flags it for repair
const bad = normalizeDraft({ settings: {}, blocks: [{ trials: [{ stimulus: 'A', validKeys: ['f'], correctKey: 'x' }] }] });
assert.equal(experimentSchema.safeParse(bad).success, false);
// unsupported key names are reported
const odd = experimentSchema.parse(normalizeDraft({ settings: {}, blocks: [{ trials: [{ stimulus: 'A', validKeys: ['shift'], correctKey: 'shift' }] }] }));
assert.equal(componentIssues(odd).length, 1);
assert.equal(componentIssues(res.data).length, 0);
assert.notEqual(out.blocks[1].trials[0].id, out.blocks[1].trials[1].id);
// compact trialTypes expand to exact counts in order, defaults applied, withhold kept
const compact = normalizeDraft({ settings: {}, blocks: [{ id: 'main', defaults: { duration: 800, validKeys: ['Space'] }, trialTypes: [
  { content: 'O', condition: 'go', correctKey: 'space', count: 40 },
  { content: 'X', condition: 'nogo', correctKey: null, withhold: true, count: 10 },
] }] });
const ct = compact.blocks[0].trials;
assert.equal(ct.length, 50);
assert.equal(ct.filter((t) => t.withhold).length, 10);
assert.equal(ct[0].duration, 800);
assert.equal(ct[0].correctKey, ' ');
assert.equal(new Set(ct.map((t) => t.id)).size, 50);
assert.ok(experimentSchema.safeParse(compact).success);
console.log('normalizeDraft ok');
