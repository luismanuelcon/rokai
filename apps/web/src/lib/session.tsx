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

interface SessionData {
  user: SessionUser | null;
  csrf?: string;
  expiresAt?: string | null;
  serverNow?: string;
}

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  error: string;
  expired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  validate: () => Promise<SessionUser | null>;
  ensure: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [deadline, setDeadline] = useState<number | null>(null);
  const started = useRef(false);
  const generation = useRef(0);
  const currentUser = useRef<SessionUser | null>(null);
  const expires = useRef<number | null>(null);
  const pending = useRef<Promise<SessionUser | null> | null>(null);

  const endSession = useCallback((wasExpired: boolean) => {
    ++generation.current;
    pending.current = null;
    expires.current = null;
    currentUser.current = null;
    setDeadline(null);
    setCsrf(null);
    setUser(null);
    setError('');
    setExpired(wasExpired);
    setLoading(false);
  }, []);

  const applySession = useCallback((data: SessionData) => {
    currentUser.current = data.user;
    setUser(data.user);
    setCsrf(data.csrf ?? null);
    // Usa el tiempo restante del servidor: no depende de un reloj local bien ajustado.
    const ttl = data.expiresAt
      ? Date.parse(data.expiresAt) - Date.parse(data.serverNow ?? new Date().toISOString())
      : NaN;
    expires.current = data.user && Number.isFinite(ttl) ? Date.now() + Math.max(0, ttl) : null;
    setDeadline(expires.current);
    setError('');
  }, []);

  const validate = useCallback((): Promise<SessionUser | null> => {
    if (expires.current !== null && Date.now() >= expires.current) {
      endSession(true);
      return Promise.resolve(null);
    }
    if (pending.current) return pending.current;
    const request = generation.current;
    const operation = (async () => {
      try {
        const data = await api<SessionData>('/auth/session', { cache: 'no-store' });
        if (request !== generation.current) return currentUser.current;
        if (!data.user) {
          endSession(currentUser.current !== null);
          return null;
        }
        applySession(data);
        return data.user;
      } catch (cause) {
        if (request === generation.current) {
          setError('No se pudo verificar la sesión. Revisa tu conexión y vuelve a intentar.');
        }
        throw cause;
      } finally {
        if (request === generation.current) setLoading(false);
      }
    })();
    pending.current = operation;
    void operation
      .finally(() => {
        if (pending.current === operation) pending.current = null;
      })
      .catch(() => {});
    return operation;
  }, [applySession, endSession]);

  const refresh = useCallback(async () => {
    await validate();
  }, [validate]);

  // Las visitas a páginas públicas no consultan la sesión.
  const ensure = useCallback(() => {
    if (started.current) return;
    started.current = true;
    void refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    const expiredSession = () => endSession(true);
    window.addEventListener('rokai:session-expired', expiredSession);
    return () => window.removeEventListener('rokai:session-expired', expiredSession);
  }, [endSession]);

  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setTimeout(() => endSession(true), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [deadline, endSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<SessionData>('/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      ++generation.current;
      pending.current = null;
      applySession(data);
      setExpired(false);
      setLoading(false);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', json: {} });
    endSession(false);
  }, [endSession]);

  const value = useMemo(
    () => ({ user, loading, error, expired, login, logout, refresh, validate, ensure }),
    [user, loading, error, expired, login, logout, refresh, validate, ensure],
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
