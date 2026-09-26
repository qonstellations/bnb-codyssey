import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate, rateLimit } from '../middlewares/index.js';
import { generateDraft } from '../controllers/generate.controller.js';

const router = Router();

const generateSchema = z.object({
  prompt: z.string().min(10, 'prompt too short — describe the experiment in more detail').max(2000),
  answers: z
    .array(z.object({ question: z.string().max(500), answer: z.string().max(500) }))
    .max(5)
    .optional(),
  forceDraft: z.boolean().optional(),
});

router.post('/', requireAuth, rateLimit, validate(generateSchema), generateDraft);

export default router;
