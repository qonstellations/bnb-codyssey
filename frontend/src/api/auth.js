import { readRefreshToken, request } from "./client.js";

export function register(name, email, password) {
  return request("POST", "/auth/register", { name, email, password });
}

export function login(email, password) {
  return request("POST", "/auth/login", { email, password });
}

export function refresh(refreshToken) {
  return request("POST", "/auth/refresh", refreshToken ? { refreshToken } : {}, { retry: false });
}

export function logout() {
  const refreshToken = readRefreshToken();
  return request("POST", "/auth/logout", refreshToken ? { refreshToken } : {});
}

/** Permanently deletes the account and everything it owns (experiments, participant data, stimuli). */
export function deleteAccount(password) {
  return request("DELETE", "/auth/me", { password });
}

export function getMe() {
  return request("GET", "/auth/me");
}
