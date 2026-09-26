import Groq from 'groq-sdk';
import { experimentSchema } from '../validators/experimentSchema.js';
import { normalizeDraft, componentIssues } from './normalizeDraft.js';
import { COMPONENTS, CAPABILITIES } from './aiCatalog.js';

// llama-3.3-70b-versatile was retired by Groq; override via GROQ_MODEL if this one goes too.
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const MAX_REPAIRS = 2;

const SHAPE = `{
  "title": string,
  "notes": string[] (0-5 short notes to the researcher: assumptions, and anything approximated with the available components),
  "settings": { "consentText": string, "instructionsText": string (must state the keys), "fullscreen": boolean, "showProgressBar": boolean, "backgroundColor": string, "textColor": string, "fontSize": number },
  "blocks": [{
    "id": string (e.g. "practice", "main"), "label": string, "shuffle": boolean, "maxRepeats": number, "repetitions": number,
    "defaults": { trial fields shared by every trial in the block: "duration", "fixationDuration", "validKeys", "itiMs", "timeoutMs", "feedback" },
    "trialTypes": [{ "content": string, "color": string (optional), "condition": string, "correctKey": string | null, "withhold": boolean (optional), "count": number, + any trial field overriding defaults }]
  }],
  "branches": [{ "id": string, "from": blockId, "to": blockId, "condition": { "metric": string, "operator": string, "value": number } }],
  "loops": [{ "id": string, "blockId": blockId, "repetitions": number }]
}
Each trialType becomes "count" identical trials (in listed order; shuffle reorders them). Do NOT write individual trials.`;

const GUIDE = `Design like an experienced cognitive psychologist:
- Follow every number the researcher gives exactly. Choose counts so requested totals and percentages are exact (e.g. 50 trials at 20% no-go = go count 40 + no-go count 10).
- Balance conditions and all stimulus/response combinations; counterbalance keys.
- Usually: a short practice block with feedback in its defaults (+ repeat-practice branch), then main block(s) without feedback.
- Include every block, branch and loop the researcher asks for (e.g. "repeat practice below 80%" = branch practice→practice, accuracy < 0.8).
- Order-dependent tasks (n-back, sequences): shuffle false and list trialTypes in order with count 1.`;

const EXAMPLE = `{"title":"Stroop","notes":["Used R/G/B/Y keys for ink colour."],"settings":{"consentText":"You are invited to take part in a short study on attention. Responses are anonymous and you may stop at any time.","instructionsText":"Respond to the INK COLOUR, not the word. R = red, G = green, B = blue, Y = yellow.","fullscreen":true,"showProgressBar":true,"backgroundColor":"#ffffff","textColor":"#1f1f1f","fontSize":48},"blocks":[{"id":"practice","label":"Practice","shuffle":true,"maxRepeats":3,"repetitions":1,"defaults":{"duration":2500,"fixationDuration":500,"itiMs":400,"validKeys":["r","g","b","y"],"feedback":{"correct":"Correct!","incorrect":"Incorrect"}},"trialTypes":[{"content":"RED","color":"#d93025","condition":"congruent","correctKey":"r","count":2},{"content":"BLUE","color":"#188038","condition":"incongruent","correctKey":"g","count":2}]},{"id":"main","label":"Main","shuffle":true,"maxRepeats":3,"repetitions":1,"defaults":{"duration":2500,"fixationDuration":500,"itiMs":400,"validKeys":["r","g","b","y"]},"trialTypes":[{"content":"GREEN","color":"#188038","condition":"congruent","correctKey":"g","count":6},{"content":"YELLOW","color":"#d93025","condition":"incongruent","correctKey":"r","count":6}]}],"branches":[{"id":"br_retry","from":"practice","to":"practice","condition":{"metric":"accuracy","operator":"<","value":0.7}}],"loops":[]}`;

const DRAFT_PROMPT = `You design psychology / cognitive-science experiments for the Codyssey builder. Output ONLY one JSON object (no prose, no fences).

${COMPONENTS}

OUTPUT SHAPE:
${SHAPE}

${GUIDE}

Example (shortened — a real Stroop lists all word/ink combinations):
${EXAMPLE}`;

const REPAIR_PROMPT = `Fix the experiment JSON so the listed errors are gone; keep the design otherwise unchanged. Allowed keys: single characters, " " (space), arrowleft, arrowright, arrowup, arrowdown, enter, click. Only text stimuli. correctKey must be in validKeys, or null (unscored); no-go trials use withhold true + correctKey null. Output the full corrected JSON object only, in this shape:
${SHAPE}`;

// The clarify step only needs to know what is possible, so it gets the short capability list.
const CLARIFY_PROMPT = `You help a researcher specify a reaction-time experiment before it is built with the Codyssey builder.

${CAPABILITIES}

Read the description and decide whether essential design details are missing: task paradigm, stimuli, response keys, number of trials/blocks, conditions, practice, adaptive rules (repeat/branch).
Be conservative: if the paradigm and response method are clear (timing/counts can take sensible defaults), output {"kind":"ready"}. Ask only when something essential is genuinely ambiguous.
Only ask about things the components above can express, and offer answers that fit them (e.g. suggest keys from the allowed list, text stimuli — never images/audio).
Otherwise output {"kind":"questions","questions":[{"id":"q1","question":string,"options":[string,...] (2-5 short suggested answers, optional)}]} with 1-5 questions.
Output raw JSON only.`;

// Identical requests (retries, demos, double clicks) are answered from memory.
// ponytail: per-process Map with TTL; move to Redis (Upstash is already wired) if running many instances.
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 100;
const cache = new Map();
export async function cached(key, fn, { keep = () => true } = {}) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  if (keep(value)) {
    cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  }
  return value;
}

function client() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

async function chatJson(messages, temperature) {
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const completion = await client().chat.completions.create({
    model,
    temperature,
    response_format: { type: 'json_object' },
    max_completion_tokens: 4000,
    // gpt-oss reasons before answering; keep it short to stay under free-tier token-per-minute limits.
    ...(model.startsWith('openai/gpt-oss') && { reasoning_effort: 'low' }),
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

/** Returns clarifying questions, or [] when the description is enough. */
export async function clarifyQuestions(prompt) {
  const { parsed } = await chatJson(
    [
      { role: 'system', content: CLARIFY_PROMPT },
      { role: 'user', content: prompt },
    ],
    0.2
  );
  if (parsed?.kind !== 'questions' || !Array.isArray(parsed.questions)) return [];
  return parsed.questions
    .filter((q) => typeof q?.question === 'string' && q.question.trim())
    .slice(0, 5)
    .map((q, i) => ({
      id: String(q.id ?? `q${i + 1}`),
      question: q.question.trim().slice(0, 300),
      options: Array.isArray(q.options) ? q.options.map(String).slice(0, 5) : [],
    }));
}

function check(parsed) {
  if (!parsed) return { ok: false, errors: ['model did not return valid JSON'], data: null };
  const draft = normalizeDraft(parsed);
  const result = experimentSchema.safeParse(draft);
  // Schema-valid but outside the supported components (e.g. unknown key names) still gets repaired.
  const issues = result.success ? componentIssues(draft) : [];
  if (result.success && !issues.length) return { ok: true, errors: [], data: result.data };
  if (result.success) return { ok: false, errors: issues, data: result.data };
  const errors = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  return { ok: false, errors, data: null };
}

/**
 * Builds a full experiment draft from the description (+ answers to the
 * clarifying questions). Normalizes the model output, validates it, and feeds
 * validation errors back for up to MAX_REPAIRS repair attempts.
 */
export async function generateExperimentDraft(prompt, answers = []) {
  const qa = answers.length
    ? `\n\nClarifications from the researcher:\n${answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n')}`
    : '';
  const messages = [
    { role: 'system', content: DRAFT_PROMPT },
    { role: 'user', content: `${prompt}${qa}` },
  ];

  let attempt = await chatJson(messages, 0.4);
  let result = check(attempt.parsed);
  // Repairs send only the shape + last JSON + errors — not the full catalog/history — to save tokens.
  for (let i = 0; i < MAX_REPAIRS && !result.ok; i++) {
    const fixed = await chatJson(
      [
        { role: 'system', content: REPAIR_PROMPT },
        { role: 'user', content: `Errors:\n${result.errors.join('\n')}\n\nJSON:\n${attempt.raw}` },
      ],
      0.2
    );
    // Keep title/notes from the first answer if the repair dropped them.
    if (fixed.parsed && attempt.parsed) fixed.parsed = { title: attempt.parsed.title, notes: attempt.parsed.notes, ...fixed.parsed };
    attempt = fixed;
    result = check(attempt.parsed);
  }

  const title = typeof attempt.parsed?.title === 'string' ? attempt.parsed.title.slice(0, 200) : null;
  const notes = Array.isArray(attempt.parsed?.notes)
    ? attempt.parsed.notes.filter((n) => typeof n === 'string' && n.trim()).slice(0, 5).map((n) => n.slice(0, 300))
    : [];
  return { ...result, title, notes, raw: attempt.parsed };
}
