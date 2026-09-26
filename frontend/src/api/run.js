import { apiBase, request } from "./client.js";

// Participant runtime — public routes, no auth header. Kept tiny on purpose:
// this module is imported by the lightweight run.html bundle (no React/Mantine).

export function loadExperiment(slug) {
  return request("GET", `/run/${slug}`);
}

export function startSession(slug, deviceInfo) {
  return request("POST", `/run/${slug}/sessions`, { deviceInfo });
}

export function updateSession(sessionId, { calibration, status } = {}) {
  const body = {};
  if (calibration !== undefined) body.calibration = calibration;
  if (status !== undefined) body.status = status;
  return request("PATCH", `/run/sessions/${sessionId}`, body);
}

export function uploadTrials(sessionId, trials) {
  return request("POST", `/run/sessions/${sessionId}/trials`, { trials });
}

export function completeSession(sessionId) {
  return request("POST", `/run/sessions/${sessionId}/complete`);
}

/** Last-chance save on tab close. Returns the sendBeacon boolean. */
export function beacon(sessionId, { trials, status } = {}) {
  const body = {};
  if (trials !== undefined) body.trials = trials;
  if (status !== undefined) body.status = status;
  const url = `${apiBase}/run/sessions/${sessionId}/beacon`;
  const blob = new Blob([JSON.stringify(body)], { type: "text/plain" });
  return navigator.sendBeacon(url, blob);
}

export function withdraw(withdrawCode) {
  return request("DELETE", `/run/withdraw/${withdrawCode}`);
}
