import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode,
} from 'react';
import type { User } from '../types/models';
import { clearTokens, getAccessToken, setTokens as persistTokens } from '../api/client';
import { login as apiLogin, register as apiRegister, fetchMe } from '../api/auth';

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterCredentials {
  username: string;
  password: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
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
    fetchMe()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
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

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    const response = await apiLogin(credentials);
    setUser(response.user);
    setAccessToken(response.accessToken);
    persistTokens(response.accessToken, response.refreshToken);
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials): Promise<void> => {
    const response = await apiRegister(credentials);
    setUser(response.user);
    setAccessToken(response.accessToken);
    persistTokens(response.accessToken, response.refreshToken);
  }, []);

  const logout = useCallback((): void => {
    setUser(null);
    setAccessToken(null);
    clearTokens();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, accessToken, isLoading, login, register, logout }),
    [user, accessToken, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
