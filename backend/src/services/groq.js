import Groq from 'groq-sdk';
import { TEMPLATE_CATALOG, catalogText } from './aiCatalog.js';

// llama-3.3-70b-versatile was retired by Groq; override via GROQ_MODEL if this one goes too.
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const MAX_REPAIRS = 2;
const MAX_BLOCKS = 12;
const METRICS = ['accuracy', 'meanRt', 'completionRate'];
const OPERATORS = ['<', '<=', '>', '>=', '==', '!='];

const SHAPE = `{
  "title": string,
  "notes": string[] (0-5 short notes to the researcher: which tasks you picked and anything requested that the library cannot do),
  "blocks": [{ "id": string (unique, e.g. "stroop_main"), "template": templateId, "block": blockId of that template, "repetitions": 1-10 (runs the block's trial list N times), "label": string (optional) }],
  "branches": [{ "from": block id, "to": block id, "metric": "accuracy" | "meanRt" | "completionRate", "operator": "<" | "<=" | ">" | ">=" | "==" | "!=", "value": number (accuracy 0-1, meanRt in ms) }],
  "loops": [{ "blockId": block id, "repetitions": 2-100 }]
}`;

const DRAFT_PROMPT = `You assemble reaction-time experiments for the Codyssey builder from a FIXED library of tested tasks. You never write trials, stimuli, keys or timing — you only pick library blocks, order them, and add repetitions, branches and loops. Output ONLY one JSON object (no prose, no fences).

LIBRARY (the only blocks that exist):
${catalogText()}

OUTPUT SHAPE:
${SHAPE}

RULES:
- Use only the template and block ids above.
- One task asked for → reproduce that template exactly: all its blocks in order, repetitions 1, plus its default retry branch.
- Several tasks → put each task's blocks in the order asked, and keep each task's default retry branch (if it has one).
- A trial count asked for → set repetitions so block trials × repetitions is as close as possible; state the actual count in notes.
- "Repeat practice below X%" → branch practice→practice, accuracy < X/100. Max ONE branch per "from" block.
- A task that is not in the library (Flanker, IAT, images, audio, questionnaires…) → use the closest library task and say so in notes.`;

const REPAIR_PROMPT = `Fix the experiment recipe JSON so the listed errors are gone; keep the design otherwise unchanged. Library:
${catalogText()}
Output the full corrected JSON object only, in this shape:
${SHAPE}`;

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

const clampInt = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v)) || min));

/** Validates the model's recipe against the library; returns a cleaned copy. */
export function checkRecipe(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ok: false, errors: ['model did not return valid JSON'], data: null };
  const errors = [];
  const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  if (!rawBlocks.length) errors.push('blocks: at least one block is required');
  if (rawBlocks.length > MAX_BLOCKS) errors.push(`blocks: at most ${MAX_BLOCKS} blocks`);

  const ids = new Set();
  const blocks = rawBlocks.slice(0, MAX_BLOCKS).map((b, i) => {
    const t = TEMPLATE_CATALOG[b?.template];
    if (!t) errors.push(`blocks[${i}]: unknown template "${b?.template}"`);
    else if (!(b.block in t.blocks)) {
      errors.push(`blocks[${i}]: template "${b.template}" has no block "${b.block}" (has ${Object.keys(t.blocks).join(', ')})`);
    }
    let id = String(b?.id ?? '').trim().slice(0, 100) || `${b?.template}_${b?.block}`;
    while (ids.has(id)) id = `${id}_${i + 1}`;
    ids.add(id);
    return {
      id,
      template: b?.template,
      block: b?.block,
      repetitions: clampInt(b?.repetitions ?? 1, 1, 10),
      ...(typeof b?.label === 'string' && b.label.trim() && { label: b.label.trim().slice(0, 200) }),
    };
  });

  const froms = new Set();
  const branches = (Array.isArray(parsed.branches) ? parsed.branches : []).map((br, i) => {
    if (!ids.has(br?.from) || !ids.has(br?.to)) errors.push(`branches[${i}]: from/to must be block ids (${[...ids].join(', ')})`);
    if (froms.has(br?.from)) errors.push(`branches[${i}]: only one branch per "from" block`);
    froms.add(br?.from);
    if (!METRICS.includes(br?.metric)) errors.push(`branches[${i}]: metric must be ${METRICS.join(' | ')}`);
    if (!OPERATORS.includes(br?.operator)) errors.push(`branches[${i}]: operator must be ${OPERATORS.join(' ')}`);
    if (!Number.isFinite(Number(br?.value))) errors.push(`branches[${i}]: value must be a number`);
    return { from: br?.from, to: br?.to, metric: br?.metric, operator: br?.operator, value: Number(br?.value) };
  });

  const loops = (Array.isArray(parsed.loops) ? parsed.loops : []).map((l, i) => {
    if (!ids.has(l?.blockId)) errors.push(`loops[${i}]: blockId must be a block id`);
    return { blockId: l?.blockId, repetitions: clampInt(l?.repetitions, 2, 100) };
  });

  return errors.length ? { ok: false, errors, data: null } : { ok: true, errors: [], data: { blocks, branches, loops } };
}

/**
 * Turns the description into a recipe of library blocks. Validation errors are
 * fed back for up to MAX_REPAIRS repair attempts.
 */
export async function generateRecipe(prompt) {
  let attempt = await chatJson(
    [
      { role: 'system', content: DRAFT_PROMPT },
      { role: 'user', content: prompt },
    ],
    0.2
  );
  let result = checkRecipe(attempt.parsed);
  for (let i = 0; i < MAX_REPAIRS && !result.ok; i++) {
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

  const title = typeof attempt.parsed?.title === 'string' ? attempt.parsed.title.slice(0, 200) : null;
  const notes = Array.isArray(attempt.parsed?.notes)
    ? attempt.parsed.notes.filter((n) => typeof n === 'string' && n.trim()).slice(0, 5).map((n) => n.slice(0, 300))
    : [];
  return { ...result, title, notes };
}
