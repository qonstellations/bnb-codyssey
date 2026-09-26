import { download, request } from "./client.js";

export function getSummary(expId) {
  return request("GET", `/results/${expId}/summary`);
}

export function getSessions(expId) {
  return request("GET", `/results/${expId}/sessions`);
}

export function getSession(expId, sessionId) {
  return request("GET", `/results/${expId}/sessions/${sessionId}`);
}

export function setExcluded(expId, sessionId, excluded) {
  return request("PATCH", `/results/${expId}/sessions/${sessionId}`, { excluded });
}

/** Downloads results: kind trials | sessions, format csv | json, scope all | clean. */
export function exportResults(expId, { kind, format, scope }) {
  return download(`/results/${expId}/export?format=${format}&kind=${kind}&scope=${scope}`, `${kind}.${format}`);
}
