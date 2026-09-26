import { apiBase, request } from "./client.js";
import {
  isDemo,
  demoLoadRun,
  demoStartSession,
  demoUpdateSession,
  demoSaveTrials,
  demoCompleteSession,
} from "./demoBackend.js";

// Participant runtime — public routes, no auth header. Kept tiny on purpose:
// this module is imported by the lightweight run.html bundle (no React/Mantine).
// The backend wraps payloads in an ApiResponse envelope — unwrap once here so
// the runtime keeps its pre-envelope shape (the researcher app reads .data itself).

const inner = (p) => p.then((body) => body?.data ?? body);

export function loadExperiment(slug) {
  if (isDemo()) return demoLoadRun(slug);
  return inner(request("GET", `/run/${slug}`));
}

export function startSession(slug, deviceInfo) {
  if (isDemo()) return demoStartSession();
  return inner(request("POST", `/run/${slug}/sessions`, { deviceInfo }));
}

export function updateSession(sessionId, { calibration, status } = {}) {
  if (isDemo()) return demoUpdateSession();
  const body = {};
  if (calibration !== undefined) body.calibration = calibration;
  if (status !== undefined) body.status = status;
  return request("PATCH", `/run/sessions/${sessionId}`, body);
}

export function uploadTrials(sessionId, trials) {
  if (isDemo()) return demoSaveTrials(trials);
  return request("POST", `/run/sessions/${sessionId}/trials`, { trials });
}

export function completeSession(sessionId) {
  if (isDemo()) return demoCompleteSession();
  return inner(request("POST", `/run/sessions/${sessionId}/complete`));
}

/** Last-chance save on tab close. Returns the sendBeacon boolean. */
export function beacon(sessionId, { trials, status } = {}) {
  if (isDemo()) return true;
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
