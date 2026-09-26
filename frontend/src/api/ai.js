import { request } from "./client.js";
import { isDemo } from "./demoBackend.js";

// AI experiment generation. The backend owns the Groq call (API key stays
// server-side). Returns either { kind: "questions", questions } or
// { kind: "draft", title, draft, valid, errors }.
export function generateExperiment({ prompt, answers, forceDraft } = {}) {
  if (isDemo()) {
    return Promise.reject(new Error("AI generation needs a real account — sign up or log in (guest mode has no backend)."));
  }
  return request("POST", "/generate", { prompt, answers, forceDraft });
}
