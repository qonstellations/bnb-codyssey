import Groq from 'groq-sdk';
import { experimentSchema } from '../validators/experimentSchema.js';

const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You design psychology/cognitive-science experiments and output ONLY a single JSON object matching this exact shape (no prose, no markdown fences):

{
  "settings": {
    "consentText": string (required, 1-10000 chars),
    "fullscreen": boolean,
    "showProgressBar": boolean,
    "instructionsText": string | null,
    "backgroundColor": string | null,
    "textColor": string | null,
    "fontSize": number | null
  },
  "blocks": [
    {
      "id": string (unique across blocks),
      "label": string,
      "shuffle": boolean,
      "maxRepeats": number (1-20),
      "repetitions": number (1-100, optional),
      "trials": [
        {
          "id": string,
          "stimulus": { "type": "text"|"image"|"audio", "content": string (required if type is text), "url": string (required if type is image/audio, must be a valid URL) },
          "duration": number (ms, 1-60000),
          "fixationDuration": number (ms, 0-10000),
          "validKeys": string[] (1-10 keys, e.g. ["ArrowLeft","ArrowRight"]),
          "correctKey": string | null (MUST be one of validKeys if set),
          "condition": string (label for grouping, e.g. "congruent"),
          "feedback": { "correct": string, "incorrect": string } (optional),
          "timeoutMs": number | null,
          "itiMs": number | null
        }
      ]
    }
  ],
  "branches": [
    { "id": string, "from": blockId, "to": blockId, "condition": { "metric": "accuracy"|"meanRt"|"completionRate", "operator": "<"|"<="|">"|">="|"=="|"!=", "value": number } }
  ],
  "loops": [
    { "id": string, "blockId": blockId, "repetitions": number (2-100) }
  ]
}

Rules: at least 1 block, each block at least 1 trial. Do not invent image/audio URLs you cannot back — prefer "text" stimuli unless the user's description clearly needs an image/audio asset. branches/loops are optional; only include them if the description asks for adaptive/repeating behavior. Output raw JSON only.`;

/**
 * Calls Groq to turn a plain-text experiment description into a draft
 * matching experimentSchema. Validates the result and retries once with
 * the validation errors fed back if it doesn't pass.
 * ponytail: single retry ceiling — add a retry loop/backoff if this proves flaky.
 */
export async function generateExperimentDraft(prompt) {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  async function callOnce(messages) {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages,
    });
    const raw = completion.choices?.[0]?.message?.content ?? '';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { raw, parsed: null, result: { ok: false, errors: ['model did not return valid JSON'], data: null } };
    }
    const result = experimentSchema.safeParse(parsed);
    if (result.success) return { raw, parsed, result: { ok: true, errors: [], data: result.data } };
    const errors = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    return { raw, parsed, result: { ok: false, errors, data: null } };
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  let attempt = await callOnce(messages);
  if (attempt.result.ok) {
    return { ok: true, data: attempt.result.data, errors: [], raw: attempt.parsed };
  }

  messages.push({ role: 'assistant', content: attempt.raw });
  messages.push({
    role: 'user',
    content: `That JSON is invalid. Fix these issues and return the full corrected JSON object only:\n${attempt.result.errors.join('\n')}`,
  });
  attempt = await callOnce(messages);

  return {
    ok: attempt.result.ok,
    data: attempt.result.data,
    errors: attempt.result.errors,
    raw: attempt.parsed,
  };
}
