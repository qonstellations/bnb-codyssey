// The only building blocks the AI may use: the 6 coded templates in
// frontend/src/shared/templates/index.js. The AI picks blocks by id; the
// frontend copies their trials verbatim. Keep in sync — templates.check.mjs
// fails if ids, block ids or trial counts drift.

const RETRY = { metric: 'accuracy', operator: '<', value: 0.7 };

export const TEMPLATE_CATALOG = {
  'simple-rt': {
    name: 'Simple reaction time',
    measures: 'processing speed; press SPACE when a dot appears after a variable wait',
    keys: 'SPACE',
    blocks: { main: 5 },
    retry: null,
  },
  'choice-rt': {
    name: 'Choice reaction time',
    measures: 'choice cost; arrow ← / → answered with F / J',
    keys: 'F, J',
    blocks: { practice: 2, main: 4 },
    retry: 'practice',
  },
  'go-nogo': {
    name: 'Go / No-Go',
    measures: 'response inhibition; press SPACE for O, withhold on X (25% no-go)',
    keys: 'SPACE',
    blocks: { practice: 2, main: 8 },
    retry: 'practice',
  },
  stroop: {
    name: 'Stroop',
    measures: 'interference; colour words in congruent/incongruent ink, answer the ink colour',
    keys: 'R, G, B, Y',
    blocks: { practice: 2, main: 4 },
    retry: 'practice',
  },
  '2-back': {
    name: '2-back working memory',
    measures: 'working memory; letter stream, J if same as 2 back, else F (fixed order, has feedback)',
    keys: 'F, J',
    blocks: { main: 7 },
    retry: null,
  },
  'task-switch': {
    name: 'Task switching',
    measures: 'switch cost; digit judged ODD/EVEN or LOW/HIGH depending on the cue',
    keys: 'F, J',
    blocks: { practice: 2, mixed: 4 },
    retry: null,
  },
};

export function catalogText() {
  return Object.entries(TEMPLATE_CATALOG)
    .map(([id, t]) => {
      const blocks = Object.entries(t.blocks)
        .map(([b, n]) => `"${b}" (${n} trials${b === 'practice' ? ', with feedback' : ''})`)
        .join(', ');
      const retry = t.retry
        ? ` Default retry branch: ${t.retry} → ${t.retry} when accuracy < ${RETRY.value}.`
        : '';
      return `- template "${id}" — ${t.name}: ${t.measures}. Keys ${t.keys}. Blocks in order: ${blocks}.${retry}`;
    })
    .join('\n');
}
