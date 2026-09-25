import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient, bindAuthCallbacks, getAccessToken, type SafeUser } from './api';

/**
 * Auth state lives here and only here: the access token in sessionStorage
 * (memory-ish for a demo client), the refresh token in localStorage.
 * Demo simplification — see README.
 */

interface AuthState {
  user: SafeUser | null;
  loading: boolean; // initial session restore in flight
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function readStoredUser(): SafeUser | null {
  try {
    const raw = sessionStorage.getItem('echogpt.user');
    return raw ? (JSON.parse(raw) as SafeUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(readStoredUser);
  const [loading, setLoading] = useState<boolean>(() => !!localStorage.getItem('echogpt.refresh'));

  const clearSession = useCallback(() => {
    sessionStorage.removeItem('echogpt.access');
    sessionStorage.removeItem('echogpt.user');
    localStorage.removeItem('echogpt.refresh');
    setUser(null);
  }, []);

  const storeSession = useCallback((access: string, refresh: string, u: SafeUser) => {
    sessionStorage.setItem('echogpt.access', access);
    sessionStorage.setItem('echogpt.user', JSON.stringify(u));
    localStorage.setItem('echogpt.refresh', refresh);
    setUser(u);
  }, []);

  // wire the api client's refresh flow into this context
  useEffect(() => {
    bindAuthCallbacks({
      getRefreshToken: () => localStorage.getItem('echogpt.refresh'),
      onTokensRefreshed: (access, refresh) => {
        sessionStorage.setItem('echogpt.access', access);
        localStorage.setItem('echogpt.refresh', refresh);
      },
      onSessionExpired: clearSession,
    });
  }, [clearSession]);

  // restore the session on page load via refresh token
  useEffect(() => {
    const refresh = localStorage.getItem('echogpt.refresh');
    if (!refresh) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1'}/auth/refresh`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ refreshToken: refresh }),
          },
        );
        if (!response.ok) {
          clearSession();
          return;
        }
        const data = (await response.json()) as { accessToken: string; refreshToken: string };
        const me = await (async () => {
          // /auth/me with the fresh access token
          const meResponse = await fetch(
            `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1'}/auth/me`,
            { headers: { authorization: `Bearer ${data.accessToken}` } },
          );
          return meResponse.ok ? ((await meResponse.json()) as SafeUser) : null;
        })();
        if (!cancelled && me) {
          storeSession(data.accessToken, data.refreshToken, me);
        } else if (!cancelled) {
          clearSession();
        }
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiClient.login(email, password);
    storeSession(data.accessToken, data.refreshToken, data.user);
  }, [storeSession]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const data = await apiClient.register(email, password, name);
    storeSession(data.accessToken, data.refreshToken, data.user);
  }, [storeSession]);

  const logout = useCallback(() => {
    const refresh = localStorage.getItem('echogpt.refresh');
    // best-effort server-side revocation; clear locally regardless
    if (refresh && getAccessToken()) {
      void apiClient.logoutAll().catch(() => {});
    }
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const me = await apiClient.me();
    sessionStorage.setItem('echogpt.user', JSON.stringify(me));
    setUser(me);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
