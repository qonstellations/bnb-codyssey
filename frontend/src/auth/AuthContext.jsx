import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth.js";
import { setToken, setOnUnauthorized } from "../api/client.js";

const TOKEN_KEY = "authToken";
const REFRESH_KEY = "refreshToken";

// ---- TEMPORARY demo auth (dev only, remove before production) ----
// Enabled only when VITE_DEMO_AUTH=true (see .env, gitignored).
const DEMO_EMAIL = "demo@codyssey.local";
const DEMO_PASSWORD = "demo1234";
const DEMO_TOKEN = "demo-token";
const demoEnabled = import.meta.env.VITE_DEMO_AUTH === "true";
function demoUser() {
  return { id: "demo-user", name: "Demo Researcher", email: DEMO_EMAIL };
}
export const DEMO_CREDS =
  demoEnabled ? { email: DEMO_EMAIL, password: DEMO_PASSWORD } : null;

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
    const stored = readStoredToken();
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setToken(stored);
    if (stored === DEMO_TOKEN && demoEnabled) {
      // Temporary demo session — no backend to validate against.
      setUser(demoUser());
      setTokenState(stored);
      setIsLoading(false);
      return;
    }
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
    if (demoEnabled && email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      setToken(DEMO_TOKEN);
      storeSession(DEMO_TOKEN, null);
      const u = demoUser();
      setUser(u);
      setTokenState(DEMO_TOKEN);
      return u;
    }
    const payload = await authApi.login(email, password);
    const { user: u, token: t } = applyPayload(payload);
    setUser(u);
    setTokenState(t);
    return u;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    if (demoEnabled) {
      setToken(DEMO_TOKEN);
      storeSession(DEMO_TOKEN, null);
      const u = { id: "demo-user", name: name || "Demo Researcher", email };
      setUser(u);
      setTokenState(DEMO_TOKEN);
      return u;
    }
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
