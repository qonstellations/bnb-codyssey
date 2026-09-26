import { request } from "./client.js";

// AI experiment generation. The backend owns the Groq call (API key stays server-side).

// → { kind: "questions", understood, questions: [{ id, question, options }] }
export function askQuestions({ prompt, fresh } = {}) {
  return request("POST", "/generate", { step: "questions", prompt, fresh });
}

// → { kind: "draft", title, notes, recipe, valid, errors }; the recipe references
// template-library blocks (composeFromTemplates expands it). Pass `previous` +
// `refinement` to edit an earlier recipe; `fresh` skips the server cache.
export function draftExperiment({ prompt, answers, previous, refinement, fresh } = {}) {
  return request("POST", "/generate", { step: "draft", prompt, answers, previous, refinement, fresh });
}
