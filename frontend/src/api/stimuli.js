import { put } from "@vercel/blob/client";
import { request } from "./client.js";

/** Upload a file straight to Vercel Blob. The client token comes through request(),
 *  so it carries our auth header — the SDK's upload()/handleUploadUrl sends none. */
export async function uploadStimulusFile(file) {
  const { clientToken } = await request("POST", "/stimuli/upload-url", {
    filename: file.name,
    contentType: file.type,
  });
  return put(file.name, file, { access: "public", token: clientToken, contentType: file.type });
}

export function listStimuli() {
  return request("GET", "/stimuli");
}

export function saveStimulus({ name, type, url, size }) {
  return request("POST", "/stimuli", { name, type, url, size });
}

export function deleteStimulus(id) {
  return request("DELETE", `/stimuli/${id}`);
}
