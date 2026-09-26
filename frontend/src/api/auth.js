import { request } from "./client.js";

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
  return request("POST", "/auth/logout");
}

export function getMe() {
  return request("GET", "/auth/me");
}
