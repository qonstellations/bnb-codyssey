import { createHash } from 'node:crypto';
import Groq from 'groq-sdk';
import { LIMITS, TEMPLATE_CATALOG, catalogText } from './aiCatalog.js';

// llama-3.3-70b-versatile was retired by Groq; override via GROQ_MODEL if this one goes too.
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const MAX_REPAIRS = 2;
const MAX_STEPS = 12;
const MAX_QUESTIONS = 3;

const SHAPE = `{
  "title": string (short study name),
  "notes": string[] (0-4 short notes to the researcher: choices you made, and anything asked for that the library cannot do),
  "steps": [{
    "id": string (unique, e.g. "stroop_practice"),
    "task": task id,
    "block": block id of that task,
    "trials": integer (optional — total trials wanted for this step; omit to keep the library count),
    "label": string (optional),
    "responseMs": integer (optional — response window in ms),
    "fixationMs": integer (optional — fixation before each stimulus, only where tunable),
    "feedback": boolean (optional — false hides per-trial Correct/Incorrect)
  }],
  "retries": [{ "step": step id, "below": number 0.5-0.95 }] (repeat that step once more when its accuracy is below the value; at most 2 retries happen)
}`;

const LIBRARY = `LIBRARY (the only tasks and blocks that exist; every trial is pre-built):
${catalogText()}`;

const QUESTIONS_PROMPT = `You help a researcher set up a reaction-time experiment in Codyssey before it is built.
${LIBRARY}

Tunable: which tasks and in what order, trials per block, response window, fixation, per-trial feedback, practice blocks and their retry threshold. NOT tunable: keys, stimuli, colours, conditions, images/audio.

Read the description and ask 1-${MAX_QUESTIONS} short multiple-choice questions about the tunable things it leaves open, most important first:
- If no library task clearly matches (or an unsupported paradigm like Flanker/IAT is named), FIRST ask which library task to use, options = the 2-4 closest tasks by their display name (e.g. "Choice reaction time"), each with a few words on why.
- Otherwise ask about what is still unspecified among: length, practice + retry threshold, feedback, pace.
- Ask length as the total trials of the main task in round numbers ("About 20 trials", "About 60 trials", "About 120 trials"). Never mention unique trials, library defaults, block ids or task ids.
- Never ask about something the description already states, or about anything not tunable.
Write for a researcher, not a developer: plain words, short concrete options (e.g. "Repeat practice below 80%").
Output ONLY JSON: {"understood": string (one plain sentence describing the study you would build, e.g. "A Stroop task with a short practice, then Go / No-Go."), "questions": [{"id": "q1", "question": string, "options": [string, ...] (2-4)}]}`;

const DRAFT_PROMPT = `You assemble reaction-time experiments for the Codyssey builder from a FIXED library of tested tasks. You never write trials; you pick library blocks, order them, and set a few knobs. Output ONLY one JSON object (no prose, no fences).

${LIBRARY}

OUTPUT SHAPE:
${SHAPE}

RULES:
- Use only the task and block ids above. For each task used, include its blocks in library order (practice before main) unless the researcher says no practice.
- A trial count asked for → put it in "trials" of the main/mixed step (practice keeps its default unless asked). Do not compute repetitions yourself.
- Set responseMs / fixationMs / feedback ONLY when the researcher asks or clearly implies it ("fast-paced" → shorter response window, "no feedback" → feedback false on every step, "feedback only in practice" → false on non-practice steps).
- Practice steps of tasks that usually retry get a retry (below 0.7) unless the researcher says otherwise; use their threshold if given. At most one retry per step.
- A task not in the library → use the closest library task and say so in notes. Key or stimulus changes are not possible → say so in notes.
- When a CURRENT RECIPE and a CHANGE REQUEST are given: apply only the requested change and keep everything else identical. Study-wide choices from the description or answers (e.g. no feedback, fast pace, retry threshold) also apply to any task the change adds.
- Notes are for a researcher: plain words, no ids, no field names.`;

const REPAIR_PROMPT = `Fix the experiment recipe JSON so the listed errors are gone; keep the design otherwise unchanged.
${LIBRARY}
Output the full corrected JSON object only, in this shape:
${SHAPE}`;

// Used when the model returns no usable questions — the question round always appears.
export const FALLBACK_QUESTIONS = [
  { id: 'length', question: 'About how long should the main task be?', options: ['Short (~20 trials)', 'Standard (~60 trials)', 'Long (~120 trials)'] },
  { id: 'practice', question: 'Practice before the main task?', options: ['Yes, repeat if accuracy below 70%', 'Yes, repeat if accuracy below 80%', 'Yes, once, no repeat', 'No practice'] },
  { id: 'feedback', question: 'Show Correct / Incorrect after each trial?', options: ['Every block', 'Practice only', 'Never'] },
];

// Identical requests (double clicks, demos) are answered from memory; `fresh` skips the read.
// ponytail: per-process Map with TTL; move to Redis (Upstash is already wired) if running many instances.
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 100;
const cache = new Map();
export async function cached(body, fn, { keep = () => true, fresh = false } = {}) {
  const key = createHash('sha1').update(JSON.stringify(body)).digest('hex');
  const hit = cache.get(key);
  if (!fresh && hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  if (keep(value)) {
    cache.delete(key);
    cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  }
  return value;
}

function client() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

async function chatJson(messages, temperature, effort = 'low') {
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const completion = await client().chat.completions.create({
    model,
    temperature,
    response_format: { type: 'json_object' },
    max_completion_tokens: 6000,
    ...(model.startsWith('openai/gpt-oss') && { reasoning_effort: effort }),
    messages,
  });
  const u = completion.usage;
  if (u) console.log(`[ai] ${model} prompt=${u.prompt_tokens} completion=${u.completion_tokens} total=${u.total_tokens}`);
  const raw = completion.choices?.[0]?.message?.content ?? '';
  try {
    return { raw, parsed: JSON.parse(raw) };
  } catch {
    return { raw, parsed: null };
  }
}

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** 1-3 multiple-choice questions about the open knobs, plus a one-line summary. */
export async function askQuestions(prompt) {
  const { parsed } = await chatJson(
    [
      { role: 'system', content: QUESTIONS_PROMPT },
      { role: 'user', content: prompt },
    ],
    0.2
  );
  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : [])
    .filter((q) => str(q?.question, 300))
    .slice(0, MAX_QUESTIONS)
    .map((q, i) => ({
      id: String(q.id ?? `q${i + 1}`).slice(0, 40),
      question: str(q.question, 300),
      options: (Array.isArray(q.options) ? q.options : []).map((o) => str(String(o), 120)).filter(Boolean).slice(0, 4),
    }));
  return {
    understood: str(parsed?.understood, 400),
    questions: questions.length ? questions : FALLBACK_QUESTIONS,
  };
}

// Clamp v into [min, max]; returns [value, clamped?].
function clamp(v, [min, max]) {
  const n = Number(v);
  const c = Math.min(max, Math.max(min, n));
  return [Math.round(c * 100) / 100, c !== n];
}

/**
 * Validates the model's recipe against the library and clamps knobs into range.
 * Structural problems → errors (fed to the repair loop). Clamps → human `adjustments`.
 */
export function checkRecipe(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ok: false, errors: ['model did not return valid JSON'], data: null, adjustments: [] };
  const errors = [];
  const adjustments = [];
  const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
  if (!rawSteps.length) errors.push('steps: at least one step is required');
  if (rawSteps.length > MAX_STEPS) errors.push(`steps: at most ${MAX_STEPS} steps`);

  const ids = new Set();
  const steps = rawSteps.slice(0, MAX_STEPS).map((s, i) => {
    const t = TEMPLATE_CATALOG[s?.task];
    if (!t) errors.push(`steps[${i}]: unknown task "${s?.task}" (tasks: ${Object.keys(TEMPLATE_CATALOG).join(', ')})`);
    else if (!(s.block in t.blocks)) errors.push(`steps[${i}]: task "${s.task}" has no block "${s.block}" (has ${Object.keys(t.blocks).join(', ')})`);
    let id = str(s?.id, 100) ?? `${s?.task}_${s?.block}`;
    while (ids.has(id)) id = `${id}_${i + 1}`;
    ids.add(id);
    const name = t ? `${t.name} ${s.block}` : id;
    const step = { id, task: s?.task, block: s?.block };
    const label = str(s?.label, 200);
    if (label) step.label = label;

    if (s?.trials != null && Number.isFinite(Number(s.trials))) {
      const [v, c] = clamp(Math.round(s.trials), LIMITS.trials);
      step.trials = v;
      if (c) adjustments.push(`${name}: trial count limited to ${v}.`);
    }
    if (s?.responseMs != null && Number.isFinite(Number(s.responseMs))) {
      const [v, c] = clamp(Math.round(s.responseMs), LIMITS.responseMs);
      step.responseMs = v;
      if (c) adjustments.push(`${name}: response window set to ${v} ms (allowed ${LIMITS.responseMs.join('–')} ms).`);
    }
    if (s?.fixationMs != null && Number.isFinite(Number(s.fixationMs)) && t) {
      if (t.fixationMs == null) adjustments.push(`${t.name} keeps its built-in fixation timing.`);
      else {
        const [v, c] = clamp(Math.round(s.fixationMs), LIMITS.fixationMs);
        step.fixationMs = v;
        if (c) adjustments.push(`${name}: fixation set to ${v} ms (allowed ${LIMITS.fixationMs.join('–')} ms).`);
      }
    }
    if (typeof s?.feedback === 'boolean') step.feedback = s.feedback;
    return step;
  });

  const retried = new Set();
  const retries = [];
  (Array.isArray(parsed.retries) ? parsed.retries : []).forEach((r, i) => {
    if (!ids.has(r?.step)) return errors.push(`retries[${i}]: step must be one of ${[...ids].join(', ')}`);
    if (retried.has(r.step)) return; // duplicate retry on the same step: keep the first
    if (!Number.isFinite(Number(r?.below))) return errors.push(`retries[${i}]: below must be a number 0.5-0.95`);
    // Accept "80" as 80%.
    const [v, c] = clamp(Number(r.below) > 1 ? Number(r.below) / 100 : r.below, LIMITS.below);
    if (c) adjustments.push(`Retry threshold set to ${Math.round(v * 100)}% (allowed 50–95%).`);
    retried.add(r.step);
    retries.push({ step: r.step, below: v });
  });

  return errors.length
    ? { ok: false, errors, data: null, adjustments }
    : { ok: true, errors: [], data: { steps, retries }, adjustments };
}

function draftUserMessage({ prompt, answers = [], previous, refinement }) {
  const parts = [`DESCRIPTION:\n${prompt}`];
  if (answers.length) parts.push(`ANSWERS:\n${answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n')}`);
  if (previous && refinement) {
    parts.push(`CURRENT RECIPE:\n${JSON.stringify(previous)}`);
    parts.push(`CHANGE REQUEST:\n${refinement}`);
  }
  return parts.join('\n\n');
}

/**
 * Turns the description (+ answers, or a refinement of a previous recipe) into a
 * recipe of library blocks. Structural errors are fed back for up to MAX_REPAIRS repairs.
 */
export async function generateRecipe(input) {
  let attempt = await chatJson(
    [
      { role: 'system', content: DRAFT_PROMPT },
      { role: 'user', content: draftUserMessage(input) },
    ],
    0.3,
    'medium'
  );
  let result = checkRecipe(attempt.parsed);
  for (let i = 0; i < MAX_REPAIRS && !result.ok; i++) {
    console.warn(`[ai] repair ${i + 1}: ${result.errors.join(' | ')}`);
    const fixed = await chatJson(
      [
        { role: 'system', content: REPAIR_PROMPT },
        { role: 'user', content: `Errors:\n${result.errors.join('\n')}\n\nJSON:\n${attempt.raw}` },
      ],
      0.1
    );
    // Keep title/notes from the first answer if the repair dropped them.
    if (fixed.parsed && attempt.parsed) fixed.parsed = { title: attempt.parsed.title, notes: attempt.parsed.notes, ...fixed.parsed };
    attempt = fixed;
    result = checkRecipe(attempt.parsed);
  }
  if (!result.ok) console.warn(`[ai] gave up: ${result.errors.join(' | ')}`);

  const notes = (Array.isArray(attempt.parsed?.notes) ? attempt.parsed.notes : [])
    .map((n) => str(String(n), 300))
    .filter(Boolean)
    .slice(0, 4);
  return { ...result, title: str(attempt.parsed?.title, 200), notes: [...notes, ...result.adjustments] };
}
