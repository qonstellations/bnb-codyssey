// Built-in paradigm library. Each draft matches experimentSchema. Paradigms were
// chosen from the classic sets in Gorilla / PsyToolkit / jsPsych that fit a
// single-stimulus text trial. Deferred (need cue→target frames or positions):
// Posner cueing, Simon, Sternberg, stop-signal.

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
        makeTrials(`main_f${i}`, [{ content: '●', condition: 'go', correctKey: SPACE }], 4, {
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
    block('practice', 'Practice', makeTrials('practice', choiceSpecs, 4, choiceCommon, { feedback: true })),
    block('main', 'Main', makeTrials('main', choiceSpecs, 20, choiceCommon)),
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
const stroopCommon = { duration: 2500, validKeys: ['r', 'g', 'b', 'y'] }
const stroop = {
  settings: settings(
    'Respond to the INK COLOUR of each word, not the word itself. R = red, G = green, B = blue, Y = yellow.',
    { backgroundColor: '#f8f9fa' }
  ),
  blocks: [
    block(
      'practice',
      'Practice',
      makeTrials('practice', [...stroopCongruent, ...stroopIncongruent.filter((_, i) => i % 3 === 0)], 1, stroopCommon, {
        feedback: true,
      })
    ),
    // 12 congruent + 12 incongruent = balanced 50/50.
    block('main', 'Main', [
      ...makeTrials('main_c', stroopCongruent, 3, stroopCommon),
      ...makeTrials('main_i', stroopIncongruent, 1, stroopCommon),
    ]),
  ],
  branches: [retryPractice('practice')],
  loops: [],
}

// ─── 4. Flanker ────────────────────────────────────────────
const flankerSpecs = [
  { content: '<<<<<', condition: 'congruent', correctKey: 'f' },
  { content: '>>>>>', condition: 'congruent', correctKey: 'j' },
  { content: '>><>>', condition: 'incongruent', correctKey: 'f' },
  { content: '<<><<', condition: 'incongruent', correctKey: 'j' },
]
const flankerCommon = { duration: 1500, validKeys: ['f', 'j'] }
const flanker = {
  settings: settings('Respond to the direction of the MIDDLE arrow only. F = left (<), J = right (>).', { fontSize: 56 }),
  blocks: [
    block('practice', 'Practice', makeTrials('practice', flankerSpecs, 2, flankerCommon, { feedback: true })),
    block('main', 'Main', makeTrials('main', flankerSpecs, 10, flankerCommon)),
  ],
  branches: [retryPractice('practice')],
  loops: [],
}

// ─── 5. Go / No-Go ─────────────────────────────────────────
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
    block('practice', 'Practice', makeTrials('practice', goSpecs, 2, goCommon, { feedback: true }), { maxRepeats: 6 }),
    block('main', 'Main', makeTrials('main', goSpecs, 10, goCommon), { maxRepeats: 6 }),
  ],
  branches: [retryPractice('practice')],
  loops: [],
}

// ─── 6. Lexical decision ───────────────────────────────────
const WORDS = ['HOUSE', 'WATER', 'GARDEN', 'PENCIL', 'RIVER', 'TABLE', 'WINDOW', 'DOCTOR', 'MONEY', 'BREAD', 'CHAIR', 'FOREST', 'SUMMER', 'LETTER', 'APPLE', 'MUSIC', 'HORSE', 'PLANET', 'CANDLE', 'BOTTLE']
const NONWORDS = ['HOUBE', 'WATEL', 'GARPEN', 'PENKIL', 'RIVAT', 'TABNE', 'WINLOW', 'DOSTER', 'MONAB', 'BREAT', 'CHOIP', 'FORAST', 'SUMBLE', 'LETTOP', 'APTLE', 'MUSOK', 'HORVE', 'PLANIT', 'CANTLE', 'BOTTAL']
const toLex = (list, condition, correctKey) => list.map((content) => ({ content, condition, correctKey }))
const lexCommon = { duration: 2500, validKeys: ['f', 'j'] }
const lexical = {
  settings: settings('A string of letters will appear. Press F if it is a real English word, J if it is not.'),
  blocks: [
    block(
      'practice',
      'Practice',
      makeTrials('practice', [...toLex(['GLOVE', 'SUGAR', 'CLOUD'], 'word', 'f'), ...toLex(['GLOVT', 'SUNAR', 'CLOID'], 'nonword', 'j')], 1, lexCommon, {
        feedback: true,
      })
    ),
    block('main', 'Main', makeTrials('main', [...toLex(WORDS, 'word', 'f'), ...toLex(NONWORDS, 'nonword', 'j')], 1, lexCommon)),
  ],
  branches: [retryPractice('practice')],
  loops: [],
}

// ─── 7. 2-back ─────────────────────────────────────────────
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
const nBackCommon = { duration: 2000, fixationDuration: 0, itiMs: 500, validKeys: ['f', 'j'] }
const twoBack = {
  settings: settings('Letters appear one at a time. Press J if the letter is the SAME as the one two letters back, otherwise press F.', {
    fontSize: 64,
  }),
  blocks: [
    block('practice', 'Practice', makeTrials('practice', nBackStream(12, new Set([3, 6, 9])), 1, nBackCommon, { feedback: true }), {
      shuffle: false,
    }),
    block('main', 'Main', makeTrials('main', nBackStream(30, new Set([3, 6, 8, 11, 14, 17, 19, 22, 25, 28])), 1, nBackCommon), {
      shuffle: false,
    }),
  ],
  branches: [retryPractice('practice', 0.6)],
  loops: [],
}

// ─── 8. Task switching (parity / magnitude) ────────────────
const DIGITS = [1, 2, 3, 4, 6, 7, 8, 9]
const parity = DIGITS.map((d) => ({ content: `ODD  or  EVEN?\n\n${d}`, condition: 'parity', correctKey: d % 2 ? 'f' : 'j' }))
const magnitude = DIGITS.map((d) => ({ content: `LOW  or  HIGH?\n\n${d}`, condition: 'magnitude', correctKey: d < 5 ? 'f' : 'j' }))
const switchCommon = { duration: 3000, validKeys: ['f', 'j'] }
const taskSwitch = {
  settings: settings(
    'A question and a digit appear. ODD/EVEN: F = odd, J = even. LOW/HIGH: F = lower than 5, J = higher than 5.',
    { fontSize: 44 }
  ),
  blocks: [
    block('parity', 'Parity only', makeTrials('parity', parity, 2, switchCommon, { feedback: true })),
    block('magnitude', 'Magnitude only', makeTrials('magnitude', magnitude, 2, switchCommon, { feedback: true })),
    // Mixed: shuffled so switch and repeat trials both occur; code them from trial order at analysis.
    block('mixed', 'Mixed', makeTrials('mixed', [...parity, ...magnitude], 2, switchCommon)),
  ],
  branches: [],
  loops: [],
}

// ─── 9. Visual search ──────────────────────────────────────
function searchGrid(size, present, seed) {
  const items = Array(size).fill('T')
  if (present) items[seed % size] = 'L'
  const rows = []
  for (let i = 0; i < size; i += 4) rows.push(items.slice(i, i + 4).join('   '))
  return rows.join('\n')
}
function searchSpecs(reps) {
  const out = []
  let seed = 1
  for (const size of [4, 8, 16])
    for (const present of [true, false])
      for (let r = 0; r < reps; r++)
        out.push({
          content: searchGrid(size, present, (seed += 5)),
          condition: `${present ? 'present' : 'absent'}_${size}`,
          correctKey: present ? 'j' : 'f',
        })
  return out
}
const searchCommon = { duration: 5000, validKeys: ['f', 'j'] }
const visualSearch = {
  settings: settings('Search the display for the letter L among the Ts. Press J if an L is present, F if it is absent.', {
    fontSize: 40,
  }),
  blocks: [
    block('practice', 'Practice', makeTrials('practice', searchSpecs(1), 1, searchCommon, { feedback: true })),
    block('main', 'Main', makeTrials('main', searchSpecs(4), 1, searchCommon), { maxRepeats: 4 }),
  ],
  branches: [retryPractice('practice')],
  loops: [],
}

// ─── 10. IAT (short) ───────────────────────────────────────
const IAT_WORDS = {
  Flower: ['rose', 'tulip', 'daisy', 'lily'],
  Insect: ['wasp', 'flea', 'moth', 'roach'],
  Pleasant: ['joy', 'love', 'peace', 'happy'],
  Unpleasant: ['pain', 'hate', 'agony', 'awful'],
}
// left/right: category names sorted to E / I. Stimulus shows the reminder header.
function iatSpecs(left, right, condition) {
  const header = `E: ${left.join(' or ')}          I: ${right.join(' or ')}`
  const side = (cats, key) =>
    cats.flatMap((cat) => IAT_WORDS[cat].map((w) => ({ content: `${header}\n\n\n${w}`, condition, correctKey: key })))
  return [...side(left, 'e'), ...side(right, 'i')]
}
const iatCommon = { duration: 3000, fixationDuration: 250, itiMs: 250, validKeys: ['e', 'i'] }
const iatFeedback = { feedback: true }
const iat = {
  settings: settings(
    'Sort each word into the categories shown at the top. Press E for the LEFT category and I for the RIGHT category. Go as fast as you can while staying accurate.',
    { fontSize: 32 }
  ),
  blocks: [
    block('iat1', '1 · Flowers vs Insects', makeTrials('iat1', iatSpecs(['Flower'], ['Insect'], 'practice'), 1, iatCommon, iatFeedback)),
    block('iat2', '2 · Pleasant vs Unpleasant', makeTrials('iat2', iatSpecs(['Pleasant'], ['Unpleasant'], 'practice'), 1, iatCommon, iatFeedback)),
    block('iat3', '3 · Combined (compatible)', makeTrials('iat3', iatSpecs(['Flower', 'Pleasant'], ['Insect', 'Unpleasant'], 'compatible'), 1, iatCommon, iatFeedback)),
    block('iat4', '4 · Insects vs Flowers', makeTrials('iat4', iatSpecs(['Insect'], ['Flower'], 'practice'), 1, iatCommon, iatFeedback)),
    block('iat5', '5 · Combined (incompatible)', makeTrials('iat5', iatSpecs(['Insect', 'Pleasant'], ['Flower', 'Unpleasant'], 'incompatible'), 1, iatCommon, iatFeedback)),
  ],
  branches: [],
  loops: [],
}

// Rough run time: every trial's fixation + response window + ITI.
function estimateMinutes(draft) {
  const ms = draft.blocks.reduce(
    (sum, b) => sum + b.trials.reduce((s, t) => s + (t.fixationDuration ?? 0) + t.duration + (t.itiMs ?? 0), 0) * (b.repetitions ?? 1),
    0
  )
  return Math.max(1, Math.round(ms / 60000))
}

function entry(id, label, category, keys, description, draft) {
  const trials = draft.blocks.reduce((n, b) => n + b.trials.length, 0)
  return { id, label, category, keys, description, draft, trials, blocks: draft.blocks.length, minutes: estimateMinutes(draft) }
}

export const TEMPLATE_CATEGORIES = ['Basics', 'Attention', 'Inhibition', 'Memory', 'Language', 'Flexibility', 'Social']

export const TEMPLATES = [
  entry('simple-rt', 'Simple reaction time', 'Basics', 'Space', 'Press as soon as a dot appears. Baseline processing speed with variable foreperiods.', simpleRt),
  entry('choice-rt', 'Choice reaction time', 'Basics', 'F / J', 'Two-choice left/right arrow task. Practice with feedback, repeated if accuracy is under 70%.', choiceRt),
  entry('stroop', 'Stroop', 'Inhibition', 'R / G / B / Y', 'Name the ink colour of colour words. Measures interference from congruent vs incongruent words.', stroop),
  entry('flanker', 'Eriksen flanker', 'Attention', 'F / J', 'Respond to the centre arrow while ignoring flankers. Selective attention and response conflict.', flanker),
  entry('go-nogo', 'Go / No-Go', 'Inhibition', 'Space', 'Respond to O, withhold on X (25% no-go). Measures response inhibition and commission errors.', goNoGo),
  entry('lexical', 'Lexical decision', 'Language', 'F / J', 'Decide whether letter strings are real words. 20 words vs 20 matched pseudowords.', lexical),
  entry('2-back', '2-back working memory', 'Memory', 'F / J', 'Detect letters that match the one two positions back. Fixed sequence, ~33% targets.', twoBack),
  entry('task-switch', 'Task switching', 'Flexibility', 'F / J', 'Parity and magnitude judgements, first in pure blocks, then mixed. Measures switch costs.', taskSwitch),
  entry('visual-search', 'Visual search', 'Attention', 'F / J', 'Find an L among Ts at set sizes 4, 8 and 16. Search slope from target-present/absent RTs.', visualSearch),
  entry('iat', 'Implicit Association Test (short)', 'Social', 'E / I', 'Five-block flowers/insects × pleasant/unpleasant IAT. Compare compatible vs incompatible blocks.', iat),
]
