import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate, rateLimit } from '../middlewares/index.js';
import { generateDraft } from '../controllers/generate.controller.js';

const router = Router();

// `previous` is a recipe this route returned earlier; checkRecipe re-validates whatever
// the model makes of it, so only its size is bounded here.
const generateSchema = z.object({
  step: z.enum(['questions', 'draft']).optional(),
  prompt: z.string().min(10, 'prompt too short — describe the experiment in more detail').max(2000),
  answers: z
    .array(z.object({ question: z.string().max(500), answer: z.string().max(500) }))
    .max(5)
    .optional(),
  previous: z
    .object({ steps: z.array(z.record(z.any())).max(12), retries: z.array(z.record(z.any())).max(12) })
    .optional(),
  refinement: z.string().min(1).max(1000).optional(),
  fresh: z.boolean().optional(),
});

router.post('/', requireAuth, rateLimit, validate(generateSchema), generateDraft);

export default router;
