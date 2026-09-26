import { request } from "./client.js";

// AI experiment generation. The backend owns the Groq call (API key stays
// server-side) — we send the researcher's paragraph and get back
// { draft, valid, errors }: the draft is already validated server-side against
// the same Zod schema the builder uses.
export function generateExperiment(prompt) {
  return request("POST", "/generate", { prompt });
}
