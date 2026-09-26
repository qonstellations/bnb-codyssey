import { request } from "./client.js";

export function listExperiments() {
  return request("GET", "/experiments");
}

export function createExperiment(data = {}) {
  return request("POST", "/experiments", data);
}

export function getExperiment(id) {
  return request("GET", `/experiments/${id}`);
}

export function updateExperiment(id, data) {
  return request("PUT", `/experiments/${id}`, data);
}

export function deleteExperiment(id) {
  return request("DELETE", `/experiments/${id}`);
}

export function duplicateExperiment(id) {
  return request("POST", `/experiments/${id}/duplicate`);
}

export function publishExperiment(id) {
  return request("POST", `/experiments/${id}/publish`);
}
