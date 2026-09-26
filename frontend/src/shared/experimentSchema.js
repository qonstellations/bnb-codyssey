import { z } from 'zod'

// ponytail: schema shape not yet ratified with teammate (Phase 4 is joint) —
// built directly from API.md's `run/:slug` example + PLAN.md's builder panels.
// Revisit with teammate before Phase 8 (builder) locks its compile.js against this.

const stimulusSchema = z.object({
  type: z.enum(['text', 'image', 'audio']),
  content: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
})

const feedbackSchema = z
  .object({
    correct: z.string().optional(),
    incorrect: z.string().optional(),
  })
  .optional()

const trialSchema = z.object({
  id: z.string(),
  stimulus: stimulusSchema,
  duration: z.number().nonnegative(),
  fixationDuration: z.number().nonnegative().default(0),
  validKeys: z.array(z.string()).default([]),
  correctKey: z.string().nullable().optional(),
  timeout: z.number().nonnegative().optional(),
  iti: z.number().nonnegative().default(0),
  condition: z.string().optional(),
  feedback: feedbackSchema,
})

const blockSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  shuffle: z.boolean().default(false),
  maxRepeats: z.number().int().positive().optional(),
  repetitions: z.number().int().positive().default(1),
  trials: z.array(trialSchema).min(1),
})

const branchSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  condition: z.object({
    metric: z.string(),
    operator: z.enum(['<', '<=', '>', '>=', '==', '!=']),
    value: z.number(),
  }),
})

const loopSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  times: z.number().int().positive(),
})

const settingsSchema = z.object({
  consentText: z.string().default(''),
  instructionsText: z.string().default(''),
  fullscreen: z.boolean().default(true),
  showProgressBar: z.boolean().default(true),
  backgroundColor: z.string().default('#000000'),
  textColor: z.string().default('#ffffff'),
  fontSize: z.number().positive().default(32),
})

export const experimentSchema = z.object({
  settings: settingsSchema,
  blocks: z.array(blockSchema).min(1),
  branches: z.array(branchSchema).default([]),
  loops: z.array(loopSchema).default([]),
})

export function validateExperiment(json) {
  const result = experimentSchema.safeParse(json)
  if (result.success) return { ok: true, errors: [] }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
  )
  return { ok: false, errors }
}
