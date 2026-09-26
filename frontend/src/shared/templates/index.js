// Built-in paradigm library: 3 simple + 3 complex classics (Gorilla / PsyToolkit /
// jsPsych staples) that fit a single-stimulus text trial. Each draft matches
// experimentSchema and runs in under 20 s by default (templates.check.mjs).

const SPACE = ' '
const CONSENT =
  'You are invited to take part in a short research study. Your responses are anonymous and used for research only. Participation is voluntary and you may stop at any time by closing this page.'
// Shown after every trial: engine/index.js turns this into "Correct!" / "Incorrect" /
// "Too early" (pressed during fixation) / "Too late" (no response in time).
const FEEDBACK = { correct: 'Correct!', incorrect: 'Incorrect' }

function settings(instructionsText, extra = {}) {
  return {
    consentText: CONSENT,
    fullscreen: true,
    showProgressBar: true,
    instructionsText,
    backgroundColor: '#ffffff',
    textColor: '#1f1f1f',
    fontSize: 48,
    ...extra,
  }
}

// specs: [{ content, condition, correctKey, color? }] repeated `reps` times; `common`
// holds shared timing/keys. feedback defaults on — every block shows correct/incorrect/
// too-early/too-late after each trial, matching the 20 s-budget number checked below.
function makeTrials(prefix, specs, reps, common, { feedback = true } = {}) {
  const out = []
  for (let r = 0; r < reps; r++) {
    for (const s of specs) {
      out.push({
        id: `${prefix}_t${out.length + 1}`,
        stimulus: { type: 'text', content: s.content, ...(s.color && { color: s.color }) },
        fixationDuration: 500,
        itiMs: 400,
        ...common,
        ...(s.extra ?? {}),
        condition: s.condition,
        correctKey: s.correctKey,
        ...(feedback && { feedback: FEEDBACK }),
      })
    }
  }
  return out
}

function block(id, label, trials, extra = {}) {
  return { id, label, shuffle: true, maxRepeats: 3, repetitions: 1, trials, ...extra }
}

// Standard "redo practice if accuracy < threshold" branch.
function retryPractice(blockId, threshold = 0.7) {
  return {
    id: `br_retry_${blockId}`,
    from: blockId,
    to: blockId,
    condition: { metric: 'accuracy', operator: '<', value: threshold },
  }
}

// ─── 1. Simple RT ──────────────────────────────────────────
const simpleRt = {
  settings: settings('A dot will appear in the centre of the screen. Press SPACE as fast as you can when you see it.'),
  blocks: [
    block(
      'main',
      'Main',
      [600, 800, 1000, 1200, 1400].flatMap((fix, i) =>
        makeTrials(`main_f${i}`, [{ content: '●', condition: 'go', correctKey: SPACE }], 1, {
          duration: 1500,
          fixationDuration: fix,
          validKeys: [SPACE],
        })
      ),
      { maxRepeats: 20 }
    ),
  ],
  branches: [],
  loops: [],
}

// ─── 2. Choice RT ──────────────────────────────────────────
const choiceSpecs = [
  { content: '←', condition: 'left', correctKey: 'f' },
  { content: '→', condition: 'right', correctKey: 'j' },
]
const choiceCommon = { duration: 1500, validKeys: ['f', 'j'] }
const choiceRt = {
  settings: settings('An arrow will appear. Press F for ← (left) and J for → (right) as quickly and accurately as you can.'),
  blocks: [
    block('practice', 'Practice', makeTrials('practice', choiceSpecs, 1, choiceCommon)),
    block('main', 'Main', makeTrials('main', choiceSpecs, 2, choiceCommon)),
  ],
  branches: [retryPractice('practice')],
  loops: [],
}

// ─── 3. Stroop (colour) ────────────────────────────────────
const COLOURS = [
  { word: 'RED', hex: '#d93025', key: 'r' },
  { word: 'GREEN', hex: '#188038', key: 'g' },
  { word: 'BLUE', hex: '#1a73e8', key: 'b' },
  { word: 'YELLOW', hex: '#f9ab00', key: 'y' },
]
const stroopCongruent = COLOURS.map((c) => ({ content: c.word, color: c.hex, condition: 'congruent', correctKey: c.key }))
const stroopIncongruent = COLOURS.flatMap((w) =>
  COLOURS.filter((ink) => ink !== w).map((ink) => ({
    content: w.word,
    color: ink.hex,
    condition: 'incongruent',
    correctKey: ink.key,
  }))
)
// Trimmed a bit from the classic 2s window — 6 trials all now carry 600ms of feedback,
// and stroop needs to stay under the 20s default-run budget.
const stroopCommon = { duration: 1700, fixationDuration: 400, itiMs: 300, validKeys: ['r', 'g', 'b', 'y'] }
const stroop = {
  settings: settings(
    'Respond to the INK COLOUR of each word, not the word itself. R = red, G = green, B = blue, Y = yellow.',
    { backgroundColor: '#f8f9fa' }
  ),
  blocks: [
    block(
      'practice',
      'Practice',
      makeTrials('practice', [stroopCongruent[0], stroopIncongruent[4]], 1, stroopCommon)
    ),
    // 2 congruent + 2 incongruent = balanced 50/50.
    block('main', 'Main', makeTrials('main', [stroopCongruent[1], stroopCongruent[2], stroopIncongruent[0], stroopIncongruent[8]], 1, stroopCommon)),
  ],
  branches: [retryPractice('practice')],
  loops: [],
}

// ─── 3. Go / No-Go ─────────────────────────────────────────
// withhold on no-go = not pressing is scored correct (engine/score.js).
const goSpecs = [
  { content: 'O', condition: 'go', correctKey: SPACE },
  { content: 'O', condition: 'go', correctKey: SPACE },
  { content: 'O', condition: 'go', correctKey: SPACE },
  { content: 'X', condition: 'nogo', correctKey: null, extra: { withhold: true } },
]
// Shorter fixation/duration/ITI than the other templates — 10 trials all now carry
// 600ms of feedback, and go-nogo needs to stay under the 20s default-run budget.
const goCommon = { duration: 700, fixationDuration: 350, itiMs: 250, validKeys: [SPACE] }
const goNoGo = {
  settings: settings('Press SPACE as fast as you can when you see O. Do NOT press anything when you see X.', { fontSize: 72 }),
  blocks: [
    block('practice', 'Practice', makeTrials('practice', goSpecs.slice(2), 1, goCommon)),
    block('main', 'Main', makeTrials('main', goSpecs, 2, goCommon), { maxRepeats: 6 }),
  ],
  branches: [retryPractice('practice')],
  loops: [],
}

// ─── 5. 2-back ─────────────────────────────────────────────
// Deterministic letter stream; `targets` are positions matching the letter 2 back.
function nBackStream(length, targets, letters = 'BCDFGHJKLM') {
  const seq = []
  let pick = 0
  for (let i = 0; i < length; i++) {
    if (targets.has(i)) {
      seq.push(seq[i - 2])
      continue
    }
    let l
    do l = letters[pick++ % letters.length]
    while (l === seq[i - 2] || l === seq[i - 1])
    seq.push(l)
  }
  return seq.map((content, i) =>
    targets.has(i)
      ? { content, condition: 'target', correctKey: 'j' }
      : { content, condition: 'nontarget', correctKey: 'f' }
  )
}
const nBackCommon = { duration: 1500, fixationDuration: 0, itiMs: 500, validKeys: ['f', 'j'] }
// One short stream with feedback — a separate practice stream won't fit a 20 s run.
const twoBack = {
  settings: settings('Letters appear one at a time. Press J if the letter is the SAME as the one two letters back, otherwise press F.', {
    fontSize: 64,
  }),
  blocks: [
    block('main', 'Main', makeTrials('main', nBackStream(7, new Set([3, 5])), 1, nBackCommon), {
      shuffle: false,
    }),
  ],
  branches: [],
  loops: [],
}

// ─── 6. Task switching (parity / magnitude) ────────────────
const DIGITS = [1, 2, 3, 4, 6, 7, 8, 9]
const parity = DIGITS.map((d) => ({ content: `ODD  or  EVEN?\n\n${d}`, condition: 'parity', correctKey: d % 2 ? 'f' : 'j' }))
const magnitude = DIGITS.map((d) => ({ content: `LOW  or  HIGH?\n\n${d}`, condition: 'magnitude', correctKey: d < 5 ? 'f' : 'j' }))
// Trimmed a bit — 6 trials all now carry 600ms of feedback, and task-switch needs to
// stay under the 20s default-run budget.
const switchCommon = { duration: 1700, fixationDuration: 400, itiMs: 300, validKeys: ['f', 'j'] }
const taskSwitch = {
  settings: settings(
    'A question and a digit appear. ODD/EVEN: F = odd, J = even. LOW/HIGH: F = lower than 5, J = higher than 5.',
    { fontSize: 44 }
  ),
  blocks: [
    block('practice', 'Practice', makeTrials('practice', [parity[0], magnitude[5]], 1, switchCommon)),
    // Mixed: shuffled so switch and repeat trials both occur; code them from trial order at analysis.
    block('mixed', 'Mixed', makeTrials('mixed', [parity[3], parity[6], magnitude[1], magnitude[7]], 1, switchCommon)),
  ],
  branches: [],
  loops: [],
}

// Worst-case trial time (no response): fixation + response window + ITI + 600 ms feedback
// (engine/index.js). Excludes intro screens and practice retries.
export function estimateSeconds(draft) {
  const ms = draft.blocks.reduce(
    (sum, b) =>
      sum +
      b.trials.reduce((s, t) => s + (t.fixationDuration ?? 0) + t.duration + (t.itiMs ?? 0) + (t.feedback ? 600 : 0), 0) *
        (b.repetitions ?? 1),
    0
  )
  return Math.ceil(ms / 1000)
}

// `example` is a plain-English prompt that makes the AI rebuild exactly this template.
function entry(id, label, level, category, keys, description, measures, draft, example) {
  const trials = draft.blocks.reduce((n, b) => n + b.trials.length, 0)
  return { id, label, level, category, keys, description, measures, draft, example, trials, blocks: draft.blocks.length, seconds: estimateSeconds(draft) }
}

export const TEMPLATE_LEVELS = ['Simple', 'Complex']

export const TEMPLATES = [
  entry('simple-rt', 'Simple reaction time', 'Simple', 'Speed', 'Space', 'Press as soon as a dot appears, after an unpredictable wait.', 'Raw processing speed — the baseline every other task is compared against.', simpleRt, 'Simple reaction time task: a dot appears in the centre after a random wait of 600–1400 ms and the participant presses SPACE as fast as possible. One main block of 5 trials.'),
  entry('choice-rt', 'Choice reaction time', 'Simple', 'Speed', 'F / J', 'An arrow points left or right; press the matching key.', 'How much slower people get when they must choose between responses.', choiceRt, 'Choice reaction time task: an arrow points left or right; press F for left and J for right. A 2-trial practice block with feedback that repeats if accuracy is below 70%, then a 4-trial main block.'),
  entry('go-nogo', 'Go / No-Go', 'Simple', 'Inhibition', 'Space', 'Press for O, hold back on X.', 'Response inhibition: how often people fail to stop a prepared press.', goNoGo, 'Go / No-Go task: press SPACE when O appears and do nothing when X appears (25% no-go). A 2-trial practice block with feedback that repeats if accuracy is below 70%, then an 8-trial main block.'),
  entry('stroop', 'Stroop', 'Complex', 'Inhibition', 'R / G / B / Y', 'Name the ink colour of colour words, ignoring what the word says.', 'Interference: how much a conflicting word slows naming the ink colour.', stroop, 'Stroop task: colour words shown in congruent or incongruent ink; respond to the ink colour with R, G, B or Y. A 2-trial practice block with feedback that repeats if accuracy is below 70%, then a 4-trial main block.'),
  entry('2-back', '2-back working memory', 'Complex', 'Memory', 'F / J', 'Letters stream by; spot the ones that match the letter two steps back.', 'Working memory: holding and updating a moving sequence in mind.', twoBack, '2-back working memory task: letters appear one at a time in a fixed order; press J if the letter matches the one two back, otherwise F. One 7-trial block with feedback.'),
  entry('task-switch', 'Task switching', 'Complex', 'Flexibility', 'F / J', 'Judge a digit as odd/even or low/high, depending on the question shown.', 'Switch cost: the slowdown when the rule changes from one trial to the next.', taskSwitch, 'Task switching: a digit is judged ODD/EVEN or LOW/HIGH depending on the cue shown, using F and J. A 2-trial practice block with feedback, then a 4-trial mixed block.'),
]

const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]))

const MAX_REPETITIONS = 100 // experimentSchema block.repetitions max

// Expands an AI recipe ({ steps: [{ id, task, block, trials?, label?, responseMs?, fixationMs?,
// feedback? }], retries: [{ step, below }] }, checked and clamped server-side by checkRecipe) into
// a draft whose trials are copied verbatim from the library, with only the knobs applied.
// Trial count → block repetitions: the actual total is a multiple of the block's unique trials.
export function composeFromTemplates(recipe) {
  const used = [...new Set(recipe.steps.map((s) => s.task))].map((id) => TEMPLATE_BY_ID[id])
  const blocks = recipe.steps.map((s) => {
    const tpl = TEMPLATE_BY_ID[s.task]
    const src = tpl.draft.blocks.find((x) => x.id === s.block)
    const n = src.trials.length
    const repetitions = s.trials ? Math.min(MAX_REPETITIONS, Math.max(1, Math.round(s.trials / n))) : (src.repetitions ?? 1)
    return {
      ...structuredClone(src),
      id: s.id,
      label: s.label ?? (used.length > 1 ? `${tpl.label} · ${src.label}` : src.label),
      repetitions,
      trials: src.trials.map((t, i) => {
        const trial = { ...structuredClone(t), id: `${s.id}_t${i + 1}` }
        if (s.responseMs != null) {
          trial.duration = s.responseMs
          if (trial.timeoutMs != null) trial.timeoutMs = s.responseMs
        }
        if (s.fixationMs != null) trial.fixationDuration = s.fixationMs
        if (s.feedback === false) delete trial.feedback
        return trial
      }),
    }
  })
  const base = structuredClone(used[0].draft.settings)
  return {
    settings: {
      ...base,
      // Mixed tasks share one canvas: the smallest template font fits every task's stimuli.
      fontSize: Math.min(...used.map((t) => t.draft.settings.fontSize ?? base.fontSize)),
      instructionsText:
        used.length > 1
          ? used.map((t) => `${t.label.toUpperCase()}\n${t.draft.settings.instructionsText}`).join('\n\n')
          : base.instructionsText,
    },
    blocks,
    branches: recipe.retries.map((r) => ({
      id: `br_retry_${r.step}`,
      from: r.step,
      to: r.step,
      condition: { metric: 'accuracy', operator: '<', value: r.below },
    })),
    loops: [],
  }
}
