import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate, rateLimit } from '../middlewares/index.js';
import { generateDraft } from '../controllers/generate.controller.js';

const router = Router();

const generateSchema = z.object({
  prompt: z.string().min(10, 'prompt too short — describe the experiment in more detail').max(2000),
});

router.post('/', requireAuth, rateLimit, validate(generateSchema), generateDraft);

export default router;
