import { API_URL } from "../shared/config.js";

const BASE = `${String(API_URL ?? "").replace(/\/$/, "")}/api/v1`;

let _token = null;
let _onUnauthorized = null;

/** Called by AuthContext to keep the client in sync (avoids a circular import). */
export function setToken(token) {
  _token = token || null;
}

export function getToken() {
  return _token;
}

/** Called by AuthContext — invoked when a 401 can't be recovered via refresh. */
export function setOnUnauthorized(fn) {
  _onUnauthorized = fn || null;
}

function readRefreshToken() {
  try {
    return localStorage.getItem("refreshToken");
  } catch {
    return null;
  }
}

async function tryRefresh() {
  const refreshToken = readRefreshToken();
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const token = data?.token ?? data?.accessToken ?? null;
  if (token) setToken(token);
  return token;
}

function toError(status, payload) {
  const code = payload?.error?.code ?? `HTTP_${status}`;
  const message = payload?.error?.message ?? `Request failed (${status})`;
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

/**
 * Single request helper for the whole app.
 * - Prefixes BASE in front of `path` (pass e.g. "/experiments")
 * - Adds JSON headers + `Authorization: Bearer <token>` when a token is set
 * - Throws a readable Error with `.code` / `.status` from the API envelope
 * - On 401: tries POST /auth/refresh once, retries, else calls onUnauthorized
 */
export async function request(method, path, body, { retry = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (_token) headers.Authorization = `Bearer ${_token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && retry) {
    const newToken = await tryRefresh().catch(() => null);
    if (newToken) return request(method, path, body, { retry: false });
    if (_onUnauthorized) {
      try {
        await _onUnauthorized();
      } catch {
        // ignore handler errors — still throw the original 401 below
      }
    }
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw toError(res.status, data);
  return data;
}

export const apiBase = BASE;
