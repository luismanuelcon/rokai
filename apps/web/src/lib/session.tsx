import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, setCsrf } from './api';
import type { SessionUser } from './types';

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  ensure: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const started = useRef(false);
  const generation = useRef(0);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const data = await api<{ user: SessionUser | null; csrf?: string }>('/auth/session');
      if (request !== generation.current) return;
      setCsrf(data.csrf ?? null);
      setUser(data.user);
      setError('');
    } catch (cause) {
      if (request !== generation.current) return;
      setError('No se pudo verificar la sesión. Revisa tu conexión y vuelve a intentar.');
      throw cause;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  // La portada pública no necesita sesión: sin este arranque perezoso, cada
  // visita anónima pagaba una consulta de sesión contra la base de datos.
  const ensure = useCallback(() => {
    if (started.current) return;
    started.current = true;
    void refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    const expired = () => { ++generation.current; setCsrf(null); setUser(null); setError(''); setLoading(false); };
    const resume = () => {
      if (started.current && document.visibilityState === 'visible') void refresh().catch(() => {});
    };
    window.addEventListener('rokai:session-expired', expired);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('rokai:session-expired', expired);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: SessionUser; csrf: string }>('/auth/login', {
      method: 'POST',
      json: { email, password },
    });
    ++generation.current;
    setError('');
    setCsrf(data.csrf);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', json: {} });
    ++generation.current;
    setCsrf(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, login, logout, refresh, ensure }),
    [user, loading, error, login, logout, refresh, ensure],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider.');
  const { ensure } = ctx;
  useEffect(() => {
    ensure();
  }, [ensure]);
  return ctx;
}
