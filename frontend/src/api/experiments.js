import { request } from "./client.js";
import {
  isDemo,
  demoListExperiments,
  demoCreateExperiment,
  demoGetExperiment,
  demoUpdateExperiment,
  demoDeleteExperiment,
  demoDuplicateExperiment,
  demoPublishExperiment,
} from "./demoBackend.js";

export function listExperiments() {
  if (isDemo()) return demoListExperiments();
  return request("GET", "/experiments");
}

export function createExperiment(data = {}) {
  if (isDemo()) return demoCreateExperiment(data);
  return request("POST", "/experiments", data);
}

export function getExperiment(id) {
  if (isDemo()) return demoGetExperiment(id);
  return request("GET", `/experiments/${id}`);
}

export function updateExperiment(id, data) {
  if (isDemo()) return demoUpdateExperiment(id, data);
  return request("PUT", `/experiments/${id}`, data);
}

export function deleteExperiment(id) {
  if (isDemo()) return demoDeleteExperiment(id);
  return request("DELETE", `/experiments/${id}`);
}

export function duplicateExperiment(id) {
  if (isDemo()) return demoDuplicateExperiment(id);
  return request("POST", `/experiments/${id}/duplicate`);
}

export function publishExperiment(id) {
  if (isDemo()) return demoPublishExperiment(id);
  return request("POST", `/experiments/${id}/publish`);
}
