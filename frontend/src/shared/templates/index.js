// Built-in paradigm library: 3 simple + 3 complex classics (Gorilla / PsyToolkit /
// jsPsych staples) that fit a single-stimulus text trial. Each draft matches
// experimentSchema and runs in under 20 s by default (templates.check.mjs).

const SPACE = ' '
const CONSENT =
  'You are invited to take part in a short research study. Your responses are anonymous and used for research only. Participation is voluntary and you may stop at any time by closing this page.'
const PRACTICE_FEEDBACK = { correct: 'Correct!', incorrect: 'Incorrect' }

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
// holds shared timing/keys; practice blocks get feedback.
function makeTrials(prefix, specs, reps, common, { feedback = false } = {}) {
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
        ...(feedback && { feedback: PRACTICE_FEEDBACK }),
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
    block('practice', 'Practice', makeTrials('practice', choiceSpecs, 1, choiceCommon, { feedback: true })),
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
const stroopCommon = { duration: 2000, validKeys: ['r', 'g', 'b', 'y'] }
const stroop = {
  settings: settings(
    'Respond to the INK COLOUR of each word, not the word itself. R = red, G = green, B = blue, Y = yellow.',
    { backgroundColor: '#f8f9fa' }
  ),
  blocks: [
    block(
      'practice',
      'Practice',
      makeTrials('practice', [stroopCongruent[0], stroopIncongruent[4]], 1, stroopCommon, { feedback: true })
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
const goCommon = { duration: 800, validKeys: [SPACE] }
const goNoGo = {
  settings: settings('Press SPACE as fast as you can when you see O. Do NOT press anything when you see X.', { fontSize: 72 }),
  blocks: [
    block('practice', 'Practice', makeTrials('practice', goSpecs.slice(2), 1, goCommon, { feedback: true })),
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
    block('main', 'Main', makeTrials('main', nBackStream(7, new Set([3, 5])), 1, nBackCommon, { feedback: true }), {
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
const switchCommon = { duration: 2000, validKeys: ['f', 'j'] }
const taskSwitch = {
  settings: settings(
    'A question and a digit appear. ODD/EVEN: F = odd, J = even. LOW/HIGH: F = lower than 5, J = higher than 5.',
    { fontSize: 44 }
  ),
  blocks: [
    block('practice', 'Practice', makeTrials('practice', [parity[0], magnitude[5]], 1, switchCommon, { feedback: true })),
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

function entry(id, label, level, category, keys, description, measures, draft) {
  const trials = draft.blocks.reduce((n, b) => n + b.trials.length, 0)
  return { id, label, level, category, keys, description, measures, draft, trials, blocks: draft.blocks.length, seconds: estimateSeconds(draft) }
}

export const TEMPLATE_LEVELS = ['Simple', 'Complex']

export const TEMPLATES = [
  entry('simple-rt', 'Simple reaction time', 'Simple', 'Speed', 'Space', 'Press as soon as a dot appears, after an unpredictable wait.', 'Raw processing speed — the baseline every other task is compared against.', simpleRt),
  entry('choice-rt', 'Choice reaction time', 'Simple', 'Speed', 'F / J', 'An arrow points left or right; press the matching key.', 'How much slower people get when they must choose between responses.', choiceRt),
  entry('go-nogo', 'Go / No-Go', 'Simple', 'Inhibition', 'Space', 'Press for O, hold back on X.', 'Response inhibition: how often people fail to stop a prepared press.', goNoGo),
  entry('stroop', 'Stroop', 'Complex', 'Inhibition', 'R / G / B / Y', 'Name the ink colour of colour words, ignoring what the word says.', 'Interference: how much a conflicting word slows naming the ink colour.', stroop),
  entry('2-back', '2-back working memory', 'Complex', 'Memory', 'F / J', 'Letters stream by; spot the ones that match the letter two steps back.', 'Working memory: holding and updating a moving sequence in mind.', twoBack),
  entry('task-switch', 'Task switching', 'Complex', 'Flexibility', 'F / J', 'Judge a digit as odd/even or low/high, depending on the question shown.', 'Switch cost: the slowdown when the rule changes from one trial to the next.', taskSwitch),
]
