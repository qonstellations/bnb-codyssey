// The only building blocks the AI may use: the 6 coded templates in
// frontend/src/shared/templates/index.js. The AI picks blocks by id and may tune
// a few knobs (trial count, response window, fixation, feedback); the frontend
// copies the trials verbatim and applies the knobs. Keep in sync —
// templates.check.mjs fails if ids, block ids, trial counts or timings drift.

// `responseMs` / `fixationMs` are the library defaults. fixationMs null = not tunable
// (simple-rt's variable foreperiod is the point of the task; 2-back has no fixation).
export const TEMPLATE_CATALOG = {
  'simple-rt': {
    name: 'Simple reaction time',
    measures: 'processing speed; press SPACE when a dot appears after a variable wait',
    keys: 'SPACE',
    blocks: { main: 5 },
    retry: null,
    responseMs: 1500,
    fixationMs: null,
  },
  'choice-rt': {
    name: 'Choice reaction time',
    measures: 'choice cost; arrow ← / → answered with F / J',
    keys: 'F, J',
    blocks: { practice: 2, main: 4 },
    retry: 'practice',
    responseMs: 1500,
    fixationMs: 500,
  },
  'go-nogo': {
    name: 'Go / No-Go',
    measures: 'response inhibition; press SPACE for O, withhold on X (25% no-go)',
    keys: 'SPACE',
    blocks: { practice: 2, main: 8 },
    retry: 'practice',
    responseMs: 700,
    fixationMs: 350,
  },
  stroop: {
    name: 'Stroop',
    measures: 'interference; colour words in congruent/incongruent ink, answer the ink colour',
    keys: 'R, G, B, Y',
    blocks: { practice: 2, main: 4 },
    retry: 'practice',
    responseMs: 1700,
    fixationMs: 400,
  },
  '2-back': {
    name: '2-back working memory',
    measures: 'working memory; letter stream, J if same as 2 back, else F (fixed order)',
    keys: 'F, J',
    blocks: { main: 7 },
    retry: null,
    responseMs: 1500,
    fixationMs: null,
  },
  'task-switch': {
    name: 'Task switching',
    measures: 'switch cost; digit judged ODD/EVEN or LOW/HIGH depending on the cue',
    keys: 'F, J',
    blocks: { practice: 2, mixed: 4 },
    retry: null,
    responseMs: 1700,
    fixationMs: 400,
  },
};

export const LIMITS = {
  responseMs: [300, 5000],
  fixationMs: [0, 3000],
  trials: [1, 500],
  below: [0.5, 0.95],
};

export function catalogText() {
  return Object.entries(TEMPLATE_CATALOG)
    .map(([id, t]) => {
      const blocks = Object.entries(t.blocks)
        .map(([b, n]) => `"${b}" (${n} unique trials)`)
        .join(', ');
      const retry = t.retry ? ` Usually retries "${t.retry}" when accuracy < 70%.` : '';
      const fix = t.fixationMs == null ? 'fixation not tunable' : `fixation ${t.fixationMs} ms`;
      return `- task "${id}" — ${t.name}: ${t.measures}. Keys ${t.keys} (fixed). Blocks in order: ${blocks}. Defaults: response window ${t.responseMs} ms, ${fix}.${retry}`;
    })
    .join('\n');
}
