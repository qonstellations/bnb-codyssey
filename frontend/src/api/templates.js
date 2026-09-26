import { request } from "./client.js";
import { isDemo } from "./demoBackend.js";

// Personal (user-saved) templates. Synced via the backend; guest mode keeps
// them in localStorage like the rest of the demo backend.
const KEY = "demoTemplates";

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

function writeLocal(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage full/unavailable — template just isn't kept
  }
}

export async function listTemplates() {
  if (!isDemo()) return request("GET", "/templates");
  return { templates: readLocal().map(({ draft: _draft, ...meta }) => meta) };
}

export async function getTemplate(id) {
  if (!isDemo()) return request("GET", `/templates/${id}`);
  const template = readLocal().find((t) => t._id === id);
  if (!template) throw new Error("Template not found");
  return { template };
}

export async function createTemplate({ title, description, draft }) {
  if (!isDemo()) return request("POST", "/templates", { title, description, draft });
  const now = new Date().toISOString();
  const template = { _id: `tpl_${Date.now().toString(36)}`, title, description, draft, createdAt: now, updatedAt: now };
  writeLocal([template, ...readLocal()]);
  return { template };
}

export async function deleteTemplate(id) {
  if (!isDemo()) return request("DELETE", `/templates/${id}`);
  writeLocal(readLocal().filter((t) => t._id !== id));
  return { deleted: true };
}
