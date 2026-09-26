import { request } from "./client.js";

// AI experiment generation. The backend owns the Groq call (API key stays
// server-side) — this just sends the researcher's paragraph and gets back
// a draft JSON: { title, draft }.
export function generateExperiment(description) {
  return request("POST", "/ai/generate-experiment", { description });
}
