import { request } from "./client.js";

// AI experiment generation. The backend owns the Groq call (API key stays
// server-side) and returns { kind: "draft", title, notes, recipe, valid, errors };
// the recipe references template-library blocks (composeFromTemplates expands it).
export function generateExperiment({ prompt } = {}) {
  return request("POST", "/generate", { prompt });
}
