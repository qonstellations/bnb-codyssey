import { request } from "./client.js";
import { isDemo, demoListStimuli } from "./demoBackend.js";

export function listStimuli() {
  if (isDemo()) return demoListStimuli();
  return request("GET", "/stimuli");
}

export function getUploadUrl(filename, contentType) {
  return request("POST", "/stimuli/upload-url", { filename, contentType });
}

export function saveStimulus({ name, type, url, size }) {
  return request("POST", "/stimuli", { name, type, url, size });
}

export function deleteStimulus(id) {
  return request("DELETE", `/stimuli/${id}`);
}
