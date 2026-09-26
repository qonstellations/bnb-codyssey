import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate, rateLimit } from '../middleware.js';
import { generateExperimentDraft } from '../services/groq.js';
import { ApiError, ApiResponse, asyncHandler } from '../utils/index.js';

const router = Router();

const generateSchema = z.object({
  prompt: z.string().min(10, 'prompt too short — describe the experiment in more detail').max(2000),
});

router.post(
  '/',
  requireAuth,
  rateLimit,
  validate(generateSchema),
  asyncHandler(async (req, res) => {
    const { prompt } = req.body;

    let generated;
    try {
      generated = await generateExperimentDraft(prompt);
    } catch (err) {
      throw new ApiError(502, `Generation failed: ${err.message}`, [], '', 'GENERATION_FAILED');
    }

    res.json(
      new ApiResponse(
        200,
        { draft: generated.raw, valid: generated.ok, errors: generated.errors },
        generated.ok ? 'Draft generated' : 'Draft generated with validation issues'
      )
    );
  })
);

export default router;
