import { request } from "./client.js";

// AI experiment generation. The backend owns the Groq call (API key stays
// server-side). Returns either { kind: "questions", questions } or
// { kind: "draft", title, notes, draft, valid, errors }.
export function generateExperiment({ prompt, answers, forceDraft } = {}) {
  return request("POST", "/generate", { prompt, answers, forceDraft });
}
