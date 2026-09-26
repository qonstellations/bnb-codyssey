import { request } from "./client.js";

// Personal (user-saved) templates, synced via the backend.
export function listTemplates() {
  return request("GET", "/templates");
}

export function getTemplate(id) {
  return request("GET", `/templates/${id}`);
}

export function createTemplate({ title, description, draft }) {
  return request("POST", "/templates", { title, description, draft });
}

export function deleteTemplate(id) {
  return request("DELETE", `/templates/${id}`);
}
