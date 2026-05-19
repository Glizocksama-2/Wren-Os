import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as authApi from "./api";
import { AuthApiError, type AuthUser } from "./api";

export type { AuthUser };

interface AuthContextValue {
  user: AuthUser | null;
  expiresAt: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
  login: (input: { email: string; password: string; rememberMe: boolean }) => Promise<void>;
  register: (input: { email: string; displayName: string; password: string; confirmPassword: string; rememberMe: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const refreshTimerRef = useRef<number | null>(null);

  const applyAuthResponse = useCallback((response: authApi.AuthResponse) => {
    setUser(response.user);
    setExpiresAt(response.expiresAt);
    setSessionExpired(false);
  }, []);

  const expireSession = useCallback(() => {
    setUser(null);
    setExpiresAt(null);
    setSessionExpired(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    authApi.getMe()
      .then((response) => {
        if (!isMounted) return;
        applyAuthResponse(response);
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
        setExpiresAt(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [applyAuthResponse]);

  useEffect(() => {
    const markActive = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("keydown", markActive);
    window.addEventListener("pointerdown", markActive);
    window.addEventListener("focus", markActive);

    return () => {
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("focus", markActive);
    };
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await authApi.refresh();
      applyAuthResponse(response);
    } catch (error) {
      if (isAuthExpiredError(error)) {
        expireSession();
        return;
      }
      throw error;
    }
  }, [applyAuthResponse, expireSession]);

  useEffect(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    if (!expiresAt) return;

    const refreshAt = new Date(expiresAt).getTime() - Date.now() - REFRESH_WINDOW_MS;
    const delay = Math.max(0, refreshAt);
    refreshTimerRef.current = window.setTimeout(() => {
      if (Date.now() - lastActivityRef.current <= ACTIVE_WINDOW_MS) {
        void refreshSession();
      }
    }, delay);

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [expiresAt, refreshSession]);

  const login = useCallback(async (input: { email: string; password: string; rememberMe: boolean }) => {
    const response = await authApi.login(input);
    applyAuthResponse(response);
    navigate("/");
  }, [applyAuthResponse]);

  const register = useCallback(async (input: { email: string; displayName: string; password: string; confirmPassword: string; rememberMe: boolean }) => {
    const response = await authApi.register(input);
    applyAuthResponse(response);
    navigate("/");
  }, [applyAuthResponse]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setExpiresAt(null);
      setSessionExpired(false);
      navigate("/login");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      expiresAt,
      isAuthenticated: Boolean(user),
      isLoading,
      sessionExpired,
      login,
      register,
      logout,
      refresh: refreshSession,
      clearSessionExpired: () => setSessionExpired(false)
    }),
    [expiresAt, isLoading, login, logout, refreshSession, register, sessionExpired, user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {sessionExpired && <SessionExpiredModal onLogin={logout} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

function SessionExpiredModal({ onLogin }: { onLogin: () => Promise<void> }) {
  return (
    <div className="auth-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-expired-title">
      <section className="auth-modal">
        <h2 id="auth-expired-title">Session expired. Please log in again.</h2>
        <p>Your secure Northwatch cookie is no longer valid.</p>
        <button type="button" onClick={() => void onLogin()}>
          Go to login
        </button>
      </section>
    </div>
  );
}

function isAuthExpiredError(error: unknown) {
  return error instanceof AuthApiError && error.status === 401;
}

function navigate(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
