import { getToken } from "./client.js";

// Demo backend (dev only): when logged in with the demo account, experiment
// and results calls are served from localStorage so the full researcher flow
// (create → build → preview → results) works with no server running.
// Real backend takes over automatically with a real token.

const KEY = "demoExperiments";

function uid() {
  return `demo_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function slug() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

function write(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage full/unavailable — keep in-memory behaviour only
  }
}

function notFound() {
  const err = new Error("Experiment not found");
  err.code = "NOT_FOUND";
  err.status = 404;
  throw err;
}

function summary(e) {
  const { _id, title, status, slug: sl, createdAt, updatedAt } = e;
  return { _id, title, status, slug: sl, createdAt, updatedAt };
}

export function isDemo() {
  try {
    return getToken() === "demo-token";
  } catch {
    return false;
  }
}

export function demoListExperiments() {
  const all = read().sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  return Promise.resolve({ experiments: all.map(summary) });
}

export function demoCreateExperiment(data = {}) {
  const now = new Date().toISOString();
  const experiment = {
    _id: uid(),
    title: data.title ?? "Untitled Experiment",
    draft: data.draft ?? {},
    versions: [],
    slug: null,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  const all = read();
  all.push(experiment);
  write(all);
  return Promise.resolve({ experiment });
}

export function demoGetExperiment(id) {
  const found = read().find((e) => e._id === id);
  if (!found) notFound();
  return Promise.resolve({ experiment: found });
}

export function demoUpdateExperiment(id, data) {
  const all = read();
  const i = all.findIndex((e) => e._id === id);
  if (i === -1) notFound();
  all[i] = { ...all[i], ...data, updatedAt: new Date().toISOString() };
  write(all);
  return Promise.resolve({ experiment: all[i] });
}

export function demoDeleteExperiment(id) {
  const all = read();
  write(all.filter((e) => e._id !== id));
  return Promise.resolve({ deleted: { experiment: true, sessions: 0, trials: 0, stimuli: 0 } });
}

export function demoDuplicateExperiment(id) {
  const found = read().find((e) => e._id === id);
  if (!found) notFound();
  const now = new Date().toISOString();
  const copy = {
    ...found,
    _id: uid(),
    title: `${found.title} (Copy)`,
    versions: [],
    slug: null,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  const all = read();
  all.push(copy);
  write(all);
  return Promise.resolve({ experiment: copy });
}

export function demoPublishExperiment(id) {
  const all = read();
  const i = all.findIndex((e) => e._id === id);
  if (i === -1) notFound();
  const version = all[i].versions.length + 1;
  const sl = all[i].slug ?? slug();
  all[i] = {
    ...all[i],
    slug: sl,
    status: "active",
    versions: [...all[i].versions, { version, snapshot: all[i].draft, publishedAt: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  };
  write(all);
  return Promise.resolve({
    version,
    slug: sl,
    participantUrl: `${window.location.origin}/run/${sl}`,
  });
}

export function demoGetSummary() {
  return Promise.resolve({
    summary: {
      totalSessions: 0,
      completed: 0,
      abandoned: 0,
      excluded: 0,
      completionRate: 0,
      meanRt: 0,
      accuracy: 0,
      meanTimingScore: 0,
    },
  });
}

export function demoGetSessions() {
  return Promise.resolve({ sessions: [] });
}

export function demoListStimuli() {
  return Promise.resolve({ stimuli: [] });
}
