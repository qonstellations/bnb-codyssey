import { generateExperimentDraft } from '../services/groq.js';
import { ApiError, ApiResponse, asyncHandler } from '../utils/index.js';

export const generateDraft = asyncHandler(async (req, res) => {
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
});
