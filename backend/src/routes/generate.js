import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate, rateLimit } from '../middleware.js';
import { cached, clarifyQuestions, generateExperimentDraft } from '../services/groq.js';
import { ApiError, ApiResponse, asyncHandler } from '../utils/index.js';

const router = Router();

const generateSchema = z.object({
  prompt: z.string().min(10, 'prompt too short — describe the experiment in more detail').max(2000),
  answers: z
    .array(z.object({ question: z.string().max(500), answer: z.string().max(500) }))
    .max(5)
    .optional(),
  forceDraft: z.boolean().optional(),
});

// Two-step flow, stateless: first call may return clarifying questions; the
// follow-up call (answers or forceDraft) always returns a draft.
router.post(
  '/',
  requireAuth,
  rateLimit,
  validate(generateSchema),
  asyncHandler(async (req, res) => {
    if (!process.env.GROQ_API_KEY) {
      throw new ApiError(503, 'AI generation is not configured (GROQ_API_KEY missing on server)', [], '', 'AI_NOT_CONFIGURED');
    }
    const { prompt, answers = [], forceDraft = false } = req.body;

    try {
      if (!answers.length && !forceDraft) {
        const questions = await cached(`q:${prompt}`, () => clarifyQuestions(prompt));
        if (questions.length) {
          return res.json(new ApiResponse(200, { kind: 'questions', questions }, 'Clarification needed'));
        }
      }
      // Only valid drafts are cached, so "Try again" after a bad draft really regenerates.
      const g = await cached(`d:${prompt}:${JSON.stringify(answers)}`, () => generateExperimentDraft(prompt, answers), {
        keep: (r) => r.ok,
      });
      res.json(
        new ApiResponse(
          200,
          { kind: 'draft', title: g.title, notes: g.notes, draft: g.data ?? g.raw, valid: g.ok, errors: g.errors },
          g.ok ? 'Draft generated' : 'Draft generated with validation issues'
        )
      );
    } catch (err) {
      // Groq free tier: 413/429 = tokens-per-minute limit, not a bug — tell the user to wait.
      if (err.status === 429 || err.status === 413) {
        throw new ApiError(429, 'The AI is busy (rate limit reached). Wait about a minute and try again.', [], '', 'RATE_LIMITED');
      }
      throw new ApiError(502, `Generation failed: ${err.message}`, [], '', 'GENERATION_FAILED');
    }
  })
);

export default router;
