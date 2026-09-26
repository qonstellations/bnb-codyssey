import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth.js";
import { setToken, setOnUnauthorized, setOnRefreshed } from "../api/client.js";

const TOKEN_KEY = "authToken";
const REFRESH_KEY = "refreshToken";

const AuthContext = createContext(null);

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeSession(token, refreshToken) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  } catch {
    // storage unavailable (private mode) — session lives in memory only
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}

function applyPayload(payload) {
  const user = payload?.user ?? null;
  const token = payload?.token ?? payload?.accessToken ?? null;
  const refreshToken = payload?.refreshToken ?? null;
  if (token) setToken(token);
  storeSession(token, refreshToken);
  return { user, token };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => readStoredToken());
  const [isLoading, setIsLoading] = useState(true);

  const logoutSilent = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // best-effort — still clear local state below
    }
    logoutSilent();
  }, [logoutSilent]);

  // Restore session on mount; wire 401 recovery for the api client.
  useEffect(() => {
    setOnUnauthorized(() => logoutSilent());
    // Backend rotates the refresh token on every use — persist the new one or the
    // next silent refresh sends an already-invalidated token and force-logs-out.
    setOnRefreshed((token, refreshToken) => {
      storeSession(token, refreshToken);
      setTokenState(token);
    });
    const stored = readStoredToken();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setToken(stored);
    authApi
      .getMe()
      .then((payload) => {
        setUser(payload?.user ?? null);
        setTokenState(stored);
      })
      .catch(() => logoutSilent())
      .finally(() => setIsLoading(false));
  }, [logoutSilent]);

  const login = useCallback(async (email, password) => {
    const payload = await authApi.login(email, password);
    const { user: u, token: t } = applyPayload(payload);
    setUser(u);
    setTokenState(t);
    return u;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const payload = await authApi.register(name, email, password);
    const { user: u, token: t } = applyPayload(payload);
    setUser(u);
    setTokenState(t);
    return u;
  }, []);

  const value = useMemo(
    () => ({ user, token, isLoading, login, signup, logout }),
    [user, token, isLoading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
