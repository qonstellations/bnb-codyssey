import { cached, generateRecipe } from '../services/groq.js';
import { ApiError, ApiResponse, asyncHandler } from '../utils/index.js';

// Returns a recipe of template-library blocks; the client expands it with the
// library's coded trials (frontend/src/shared/templates composeFromTemplates).
export const generateDraft = asyncHandler(async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI generation is not configured (GROQ_API_KEY missing on server)', [], '', 'AI_NOT_CONFIGURED');
  }
  const { prompt } = req.body;

  try {
    // Only valid recipes are cached, so "Try again" after a bad one really regenerates.
    const g = await cached(`r:${prompt}`, () => generateRecipe(prompt), { keep: (r) => r.ok });
    res.json(
      new ApiResponse(
        200,
        { kind: 'draft', title: g.title, notes: g.notes, recipe: g.data, valid: g.ok, errors: g.errors },
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
});
