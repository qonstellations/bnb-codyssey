import { apiBase, request } from "./client.js";
import { API_URL } from "../shared/config.js";
import { isDemo, demoGetSummary, demoGetSessions } from "./demoBackend.js";

export function getSummary(expId) {
  if (isDemo()) return demoGetSummary();
  return request("GET", `/results/${expId}/summary`);
}

export function getSessions(expId) {
  if (isDemo()) return demoGetSessions();
  return request("GET", `/results/${expId}/sessions`);
}

export function getSession(expId, sessionId) {
  return request("GET", `/results/${expId}/sessions/${sessionId}`);
}

export function setExcluded(expId, sessionId, excluded) {
  return request("PATCH", `/results/${expId}/sessions/${sessionId}`, { excluded });
}

/** Returns a full URL string for the export download link (csv | json). */
export function exportUrl(expId, format) {
  const base = apiBase || `${String(API_URL ?? "").replace(/\/$/, "")}/api/v1`;
  return `${base}/results/${expId}/export?format=${format}`;
}
