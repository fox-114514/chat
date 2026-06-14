import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { User } from '../types/models';
import { clearTokens, setTokens as persistTokens } from '../api/client';

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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading] = useState(false);

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
