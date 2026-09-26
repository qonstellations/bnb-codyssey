import { z } from "zod";

// ---------- stimulus ----------
const stimulusSchema = z
  .object({
    type: z.enum(["text", "image", "audio"], {
      message: "stimulus.type must be 'text', 'image' or 'audio'",
    }),
    content: z.string().max(1000, "stimulus.content too long (max 1000 chars)").nullable().optional(),
    url: z.string().url("stimulus.url must be a valid URL").nullable().optional(),
  })
  .superRefine((s, ctx) => {
    if (s.type === "text" && !s.content) {
      ctx.addIssue({ code: "custom", message: "text stimulus needs 'content'", path: ["content"] });
    }
    if ((s.type === "image" || s.type === "audio") && !s.url) {
      ctx.addIssue({ code: "custom", message: `${s.type} stimulus needs 'url'`, path: ["url"] });
    }
  });

// ---------- trial ----------
const feedbackSchema = z.object({
  correct: z.string().max(200).nullable().optional(),
  incorrect: z.string().max(200).nullable().optional(),
});

const trialSchema = z.object({
  id: z.string().min(1, "trial.id is required").max(100),
  stimulus: stimulusSchema,
  duration: z.number().int().positive("trial.duration must be > 0 ms").max(60000),
  fixationDuration: z.number().int().min(0).max(10000).default(500),
  validKeys: z.array(z.string().min(1).max(10)).min(1, "trial needs at least 1 valid key").max(10),
  correctKey: z.string().min(1).max(10).nullable().optional(),
  condition: z.string().min(1, "trial.condition is required").max(100),
  feedback: feedbackSchema.optional(),
  timeoutMs: z.number().int().positive().max(60000).nullable().optional(),
  itiMs: z.number().int().min(0).max(10000).nullable().optional(),
});

// ---------- block ----------
const blockSchema = z.object({
  id: z.string().min(1, "block.id is required").max(100),
  label: z.string().min(1, "block.label is required").max(200),
  shuffle: z.boolean().default(true),
  maxRepeats: z.number().int().min(1).max(20).default(2),
  repetitions: z.number().int().min(1).max(100).default(1).optional(),
  trials: z.array(trialSchema).min(1, "block needs at least 1 trial").max(500),
});

// ---------- branches / loops ----------
const branchConditionSchema = z.object({
  metric: z.enum(["accuracy", "meanRt", "completionRate"], {
    message: "branch metric must be accuracy, meanRt or completionRate",
  }),
  operator: z.enum(["<", "<=", ">", ">=", "==", "!="], {
    message: "branch operator must be one of < <= > >= == !=",
  }),
  value: z.number(),
});

const branchSchema = z.object({
  id: z.string().min(1).max(100),
  from: z.string().min(1, "branch.from (source block id) is required"),
  to: z.string().min(1, "branch.to (target block id) is required"),
  condition: branchConditionSchema,
});

const loopSchema = z.object({
  id: z.string().min(1).max(100),
  blockId: z.string().min(1, "loop.blockId is required"),
  repetitions: z.number().int().min(2, "loop.repetitions must be >= 2").max(100),
});

// ---------- settings ----------
const settingsSchema = z.object({
  consentText: z.string().min(1, "settings.consentText is required").max(10000),
  fullscreen: z.boolean().default(true),
  showProgressBar: z.boolean().default(true),
  instructionsText: z.string().max(10000).nullable().optional(),
  backgroundColor: z.string().max(20).nullable().optional(),
  textColor: z.string().max(20).nullable().optional(),
  fontSize: z.number().int().min(8).max(72).nullable().optional(),
});

// ---------- top-level draft / snapshot ----------
export const experimentSchema = z
  .object({
    settings: settingsSchema,
    blocks: z.array(blockSchema).min(1, "experiment needs at least 1 block").max(50),
    branches: z.array(branchSchema).default([]),
    loops: z.array(loopSchema).default([]),
  })
  .superRefine((exp, ctx) => {
    const blockIds = new Set(exp.blocks.map((b) => b.id));
    // duplicate block ids
    if (blockIds.size !== exp.blocks.length) {
      ctx.addIssue({ code: "custom", message: "block ids must be unique", path: ["blocks"] });
    }
    // branch targets must exist
    for (const br of exp.branches ?? []) {
      if (!blockIds.has(br.from)) {
        ctx.addIssue({ code: "custom", message: `branch '${br.id}' from unknown block '${br.from}'`, path: ["branches"] });
      }
      if (!blockIds.has(br.to)) {
        ctx.addIssue({ code: "custom", message: `branch '${br.id}' to unknown block '${br.to}'`, path: ["branches"] });
      }
    }
    // loop targets must exist
    for (const loop of exp.loops ?? []) {
      if (!blockIds.has(loop.blockId)) {
        ctx.addIssue({ code: "custom", message: `loop '${loop.id}' targets unknown block '${loop.blockId}'`, path: ["loops"] });
      }
    }
    // correctKey must be in validKeys
    for (const block of exp.blocks) {
      for (const trial of block.trials) {
        if (trial.correctKey && !trial.validKeys.includes(trial.correctKey)) {
          ctx.addIssue({
            code: "custom",
            message: `trial '${trial.id}' correctKey '${trial.correctKey}' not in validKeys`,
            path: ["blocks"],
          });
        }
      }
    }
  });

export function validateExperiment(json) {
  const result = experimentSchema.safeParse(json);
  if (result.success) return { ok: true, errors: [], data: result.data };
  const errors = (result.error.issues ?? []).map((i) => {
    const path = i.path.length ? i.path.join(".") : "(root)";
    return `${path}: ${i.message}`;
  });
  return { ok: false, errors, data: null };
}
