// Deterministic cleanup of an LLM-generated draft before schema validation.
// Fixes cheap slips (missing ids, out-of-range numbers, dangling refs) so the
// model only gets a repair round for real design errors.

import { KEY_ALIASES, NAMED_KEYS } from './aiCatalog.js';

const DEFAULT_CONSENT = 'You are being asked to participate in a research study.';

const int = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function uniqueIds(items, prefix) {
  const seen = new Set();
  return items.map((item, i) => {
    let id = String(item?.id ?? '').trim().slice(0, 100) || `${prefix}${i + 1}`;
    while (seen.has(id)) id = `${id}_${i + 1}`;
    seen.add(id);
    return { ...item, id };
  });
}

// Runtime matches event.key.toLowerCase(): "Space" → " ", "Left" → "arrowleft", "F" → "f".
export function normalizeKey(k) {
  if (k === ' ') return ' ';
  const key = String(k ?? '').trim().toLowerCase();
  return KEY_ALIASES[key] ?? key;
}

function normalizeTrial(t) {
  const s = t.stimulus && typeof t.stimulus === 'object' ? t.stimulus : { type: 'text', content: t.stimulus };
  // ponytail: AI output is text-only — it can't reference researcher uploads, so image/audio become text.
  const stimulus = {
    type: 'text',
    content: String(s.content ?? s.url ?? '+').slice(0, 1000) || '+',
    ...(typeof s.color === 'string' && s.color.length <= 20 && { color: s.color }),
  };
  const validKeys = [...new Set((Array.isArray(t.validKeys) ? t.validKeys : []).map(normalizeKey))]
    .filter(Boolean)
    .map((k) => k.slice(0, 10))
    .slice(0, 10);
  const correctKey = t.correctKey == null ? null : normalizeKey(t.correctKey);
  const trial = {
    ...t,
    stimulus,
    duration: int(t.duration, 1, 60000, 2000),
    fixationDuration: int(t.fixationDuration, 0, 10000, 500),
    validKeys: validKeys.length ? validKeys : [' '],
    // Keep a wrong correctKey so validation flags it for repair — null would silently mean "withhold".
    correctKey,
    condition: String(t.condition ?? 'default').slice(0, 100) || 'default',
  };
  trial.timeoutMs = t.timeoutMs == null ? null : int(t.timeoutMs, 1, 60000, null);
  trial.itiMs = t.itiMs == null ? null : int(t.itiMs, 0, 10000, null);
  if (!t.feedback || typeof t.feedback !== 'object') delete trial.feedback;
  if (typeof t.withhold === 'boolean') trial.withhold = t.withhold;
  else delete trial.withhold;
  return trial;
}

// The AI writes compact blocks: shared "defaults" + "trialTypes" each with a
// "count". Expanding here keeps model output small (free-tier token limits)
// and makes counts/percentages exact. Order is kept (matters when shuffle is false).
const MAX_TRIALS = 500;
export function expandTrialTypes(block) {
  if (!Array.isArray(block.trialTypes) || (Array.isArray(block.trials) && block.trials.length)) return block.trials;
  const defaults = block.defaults && typeof block.defaults === 'object' ? block.defaults : {};
  const trials = [];
  for (const type of block.trialTypes) {
    const { count, content, color, stimulus, ...fields } = type ?? {};
    const n = int(count, 1, MAX_TRIALS, 1);
    for (let i = 0; i < n && trials.length < MAX_TRIALS; i++) {
      trials.push({ ...defaults, ...fields, stimulus: stimulus ?? { type: 'text', content, color } });
    }
  }
  return trials;
}

export function normalizeDraft(draft) {
  if (!draft || typeof draft !== 'object') return draft;
  const settings = { ...(draft.settings ?? {}) };
  if (!String(settings.consentText ?? '').trim()) settings.consentText = DEFAULT_CONSENT;
  if (settings.fontSize != null) settings.fontSize = int(settings.fontSize, 8, 72, null);

  const blocks = uniqueIds(Array.isArray(draft.blocks) ? draft.blocks : [], 'b').map((b) => ({
    ...b,
    label: String(b.label ?? b.id).slice(0, 200) || b.id,
    shuffle: b.shuffle ?? true,
    maxRepeats: int(b.maxRepeats, 1, 20, 2),
    repetitions: int(b.repetitions, 1, 100, 1),
    trials: uniqueIds(expandTrialTypes(b) ?? [], `${b.id}_t`).map(normalizeTrial),
  }));
  const ids = new Set(blocks.map((b) => b.id));

  const seenFrom = new Set();
  const branches = uniqueIds(Array.isArray(draft.branches) ? draft.branches : [], 'br').filter((br) => {
    if (!ids.has(br.from) || !ids.has(br.to) || seenFrom.has(br.from)) return false;
    seenFrom.add(br.from);
    return true;
  });
  const loops = uniqueIds(Array.isArray(draft.loops) ? draft.loops : [], 'loop')
    .filter((l) => ids.has(l.blockId))
    .map((l) => ({ ...l, repetitions: int(l.repetitions, 2, 100, 2) }));

  return { settings, blocks, branches, loops };
}

// Checks beyond the schema: everything must be a component the runtime supports.
export function componentIssues(draft) {
  const issues = [];
  for (const b of draft.blocks) {
    for (const t of b.trials) {
      for (const k of t.validKeys) {
        if (k.length > 1 && !NAMED_KEYS.includes(k)) {
          issues.push(`trial '${t.id}': key "${k}" is not supported — use a single character, " " (space), arrowleft/arrowright/arrowup/arrowdown, enter or click`);
        }
      }
      if (t.stimulus.type !== 'text') issues.push(`trial '${t.id}': only text stimuli are available`);
      if (t.withhold && t.correctKey != null) issues.push(`trial '${t.id}': withhold trials must have correctKey null`);
    }
  }
  return [...new Set(issues)].slice(0, 20);
}
