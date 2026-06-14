import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import type { User } from '../types/models';
import { api, clearTokens, getAccessToken, setTokens as persistTokens } from '../api/client';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAuth: (user: User, access: string, refresh: string) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getAccessToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get<{ user: User }>('/auth/me')
      .then((res) => {
        if (cancelled) return;
        setUser(res.data.user);
        setAccessToken(token);
      })
      .catch(() => {
        if (cancelled) return;
        clearTokens();
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setAuth = useCallback((u: User, access: string, refresh: string) => {
    setUser(u);
    setAccessToken(access);
    persistTokens(access, refresh);
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    clearTokens();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, accessToken, isLoading, setUser, setAuth, clearAuth }),
    [user, accessToken, isLoading, setAuth, clearAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
