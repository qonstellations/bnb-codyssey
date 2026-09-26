import { askQuestions, cached, generateRecipe } from '../services/groq.js';
import { ApiError, ApiResponse, asyncHandler } from '../utils/index.js';

// Two explicit steps, chosen by the client (never inferred):
//   step "questions" → { kind: "questions", understood, questions }
//   step "draft"     → { kind: "draft", title, notes, recipe, valid, errors }
// The recipe references template-library blocks; the client expands it with the
// library's coded trials (frontend/src/shared/templates composeFromTemplates).
export const generateDraft = asyncHandler(async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    throw new ApiError(503, 'AI generation is not configured (GROQ_API_KEY missing on server)', [], '', 'AI_NOT_CONFIGURED');
  }
  const { step = 'draft', prompt, answers = [], previous, refinement, fresh = false } = req.body;

  try {
    if (step === 'questions') {
      const q = await cached({ step, prompt }, () => askQuestions(prompt), { fresh });
      return res.json(new ApiResponse(200, { kind: 'questions', ...q }, 'Questions ready'));
    }

    // Only valid recipes are cached, so a retry after a bad one really regenerates.
    const g = await cached({ step, prompt, answers, previous, refinement }, () => generateRecipe({ prompt, answers, previous, refinement }), {
      keep: (r) => r.ok,
      fresh,
    });
    res.json(
      new ApiResponse(
        200,
        {
          kind: 'draft',
          title: g.title,
          notes: g.notes,
          recipe: g.data,
          valid: g.ok,
          // Raw validator strings are in the server log; the researcher gets one plain sentence.
          errors: g.ok ? [] : ["The AI couldn't put together a valid experiment from that. Try Regenerate, or rephrase and name one of the six tasks."],
        },
        g.ok ? 'Draft generated' : 'Draft generated with validation issues'
      )
    );
  } catch (err) {
    // Groq free tier: 413/429 = tokens-per-minute limit, not a bug — tell the user to wait.
    if (err.status === 429 || err.status === 413) {
      throw new ApiError(429, 'The AI is busy (rate limit reached). Wait about a minute and try again.', [], '', 'RATE_LIMITED');
    }
    console.error('[ai] generation failed:', err);
    throw new ApiError(502, "The AI service didn't respond properly. Try again in a moment.", [], '', 'GENERATION_FAILED');
  }
});
