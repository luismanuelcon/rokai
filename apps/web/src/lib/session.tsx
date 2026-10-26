import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setCsrf } from './api';
import type { SessionUser } from './types';

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await api<{ user: SessionUser | null; csrf?: string }>('/auth/session');
    setCsrf(data.csrf ?? null);
    setUser(data.user);
  }, []);

  useEffect(() => {
    void refresh().finally(() => {
      setLoading(false);
    });
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: SessionUser; csrf: string }>('/auth/login', {
      method: 'POST',
      json: { email, password },
    });
    setCsrf(data.csrf);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', json: {} });
    setCsrf(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider.');
  return ctx;
}
