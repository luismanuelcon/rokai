import { RentalHistory } from './RentalHistory';
import { TrackingActions } from '../../components/TrackingActions';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../components/Icon';
import { NavRail, type NavRailItem } from '../../components/NavRail';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import type { AdminData, Dashboard, ReservationItem } from '../../lib/types';
import { Overview } from './Overview';
import { NewRental } from './NewRental';
import { RentalTable } from './RentalTable';
import { Fleet } from './Fleet';
import { Reports } from './Reports';
import { AdminPanel } from './AdminPanel';
import { Reservations } from './Reservations';

export type View =
  'overview' | 'new' | 'active' | 'reservations' | 'history' | 'fleet' | 'reports' | 'admin';

/** Fuera de la pista desplazable: el registro es la acción más frecuente. */
const CTA: NavRailItem<View> = { value: 'new', icon: 'plus', label: 'Registrar alquiler' };

// Orden por frecuencia de uso durante la atención, no por jerarquía de menú.
const NAV: NavRailItem<View>[] = [
  { value: 'active', icon: 'clock', label: 'Alquileres activos' },
  { value: 'reservations', icon: 'calendar', label: 'Reservas' },
  { value: 'overview', icon: 'grid', label: 'Resumen' },
  { value: 'fleet', icon: 'scooter', label: 'Disponibilidad' },
  { value: 'history', icon: 'history', label: 'Historial' },
  { value: 'reports', icon: 'chart', label: 'Reportes' },
  { value: 'admin', icon: 'settings', label: 'Administración' },
];

const ADMIN_ONLY: View[] = ['reports', 'admin'];

const updatedAt = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
}).format(new Date(import.meta.env.VITE_APP_UPDATED_AT));

export function Workspace() {
  const { user, logout, refresh, validate } = useSession();
  const [view, setView] = useState<View>('overview');
  const [fromReservation, setFromReservation] = useState<ReservationItem | null>(null);
  // Cualquier navegación manual descarta la precarga de una reserva.
  const go = useCallback((next: View) => {
    setFromReservation(null);
    setView(next);
  }, []);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [toast, setToast] = useState('');
  const [createdTracking, setCreatedTracking] = useState<{
    id: number;
    trackingPath: string | null;
  } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  const [loadError, setLoadError] = useState('');

  const isAdmin = user?.role === 'admin';

  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const pendingReload = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const needsAdmin = isAdmin && (view === 'reports' || view === 'admin');

  const reload = useCallback((): Promise<void> => {
    if (pendingReload.current) return pendingReload.current;
    setRefreshing(true);
    setLoadError('');
    const operation = (async () => {
      try {
        // La sesión se comprueba antes de pedir datos protegidos al reanudar.
        const session = await validate();
        if (!session || !mounted.current) return;
        const data = await api<Dashboard>('/dashboard', { cache: 'no-store' });
        if (!mounted.current) return;
        setDash(data);
        setLastUpdatedAt(data.updatedAt);
      } catch (error) {
        if (mounted.current)
          setLoadError(error instanceof Error ? error.message : 'No se pudo cargar Gestión.');
        throw error;
      } finally {
        if (mounted.current) setRefreshing(false);
      }
    })();
    pendingReload.current = operation;
    void operation
      .finally(() => {
        if (pendingReload.current === operation) pendingReload.current = null;
      })
      .catch(() => {});
    return operation;
  }, [validate]);

  // Una devolución/alta debe ver datos posteriores a su escritura, aunque hubiera
  // una consulta automática en curso cuando se guardó la operación.
  const reloadAfterChange = useCallback(async () => {
    if (pendingReload.current) await pendingReload.current.catch(() => {});
    await reload();
  }, [reload]);

  useEffect(() => {
    mounted.current = true;
    void reload().catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  // El resumen no espera el historial/auditoría completos de Administración.
  useEffect(() => {
    if (!needsAdmin) return;
    let cancelled = false;
    void api<AdminData>('/admin/data', { cache: 'no-store' })
      .then((data) => {
        if (!cancelled) setAdmin(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setLoadError(
            cause instanceof Error ? cause.message : 'No se pudo cargar Administración.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [needsAdmin, lastUpdatedAt]);

  useEffect(() => {
    let lastResume = 0;
    const resume = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      // Foco y visibilidad suelen llegar juntos al despertar el navegador.
      if (Date.now() - lastResume < 1000) return;
      lastResume = Date.now();
      void reload().catch(() => {});
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('online', resume);
    const timer = window.setInterval(resume, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('online', resume);
      window.clearInterval(timer);
    };
  }, [reload]);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast('');
    }, 4500);
  }, []);

  if (!dash || !user)
    return (
      <main className="loading">
        {loadError ? (
          <div>
            <p role="alert">{loadError}</p>
            <button className="button primary" onClick={() => void reload().catch(() => {})}>
              Reintentar
            </button>
          </div>
        ) : (
          'Cargando la estación…'
        )}
      </main>
    );

  const visible = NAV.filter((item) => isAdmin || !ADMIN_ONLY.includes(item.value));

  return (
    <>
      {loadError && (
        <div role="alert">
          {loadError}{' '}
          <button className="button ghost" onClick={() => void reload().catch(() => {})}>
            Reintentar
          </button>
        </div>
      )}
      <header className="appbar glass-nav">
        <div className="appbar-inner">
          <Link className="appbar-brand" to="/" aria-label="ROKAI, inicio">
            <img
              src="/assets/rokai-logo-oficial-blanco.png"
              alt="ROKAI, patinetas eléctricas"
              width={2172}
              height={660}
            />
          </Link>
          <div className="appbar-user">
            <span className="nav-user">{user.name}</span>
            <button
              className="iconbutton"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={() => void logout()}
            >
              <Icon name="logout" />
            </button>
          </div>
          <NavRail label="Menú" items={visible} cta={CTA} active={view} onSelect={go} />
        </div>
      </header>

      <div className="offline" id="offline">
        {online
          ? ''
          : 'Sin conexión. Conserva esta página abierta; reintenta cuando vuelva la conexión.'}
      </div>

      <div className="management">
        <main id="main" className="workspace">
          {createdTracking && (
            <section className="panel tracking-confirmation">
              <h2>Alquiler iniciado</h2>
              <TrackingActions
                rentalId={createdTracking.id}
                initialPath={createdTracking.trackingPath}
              />
              <button className="button small outline" onClick={() => setCreatedTracking(null)}>
                Cerrar confirmación
              </button>
            </section>
          )}
          {view === 'overview' && (
            <Overview
              dash={dash}
              onRefresh={reload}
              refreshing={refreshing}
              lastUpdatedAt={lastUpdatedAt}
              user={user}
              isAdmin={isAdmin}
              onNew={() => {
                setView('new');
              }}
              onReload={reloadAfterChange}
              notify={notify}
            />
          )}
          {view === 'new' && (
            <NewRental
              key={fromReservation?.id ?? 'walk-in'}
              dash={dash}
              reservation={fromReservation}
              onDone={async (created) => {
                setCreatedTracking(created);
                setFromReservation(null);
                await reloadAfterChange();
                setView('active');
                notify('Alquiler iniciado. ¡A rodar!');
              }}
            />
          )}
          {view === 'reservations' && (
            <Reservations
              isAdmin={isAdmin}
              notify={notify}
              onStartRental={(r) => {
                setFromReservation(r);
                setView('new');
              }}
            />
          )}
          {view === 'active' && (
            <RentalTable
              title="Alquileres activos"
              rentals={dash.rentals.filter((r) => !r.endedAt)}
              lateFeePerMinuteCents={dash.lateFeePerMinuteCents}
              isAdmin={isAdmin}
              onNew={() => {
                setView('new');
              }}
              onReload={reloadAfterChange}
              notify={notify}
            />
          )}
          {view === 'history' && (
            <RentalHistory
              lateFeePerMinuteCents={dash.lateFeePerMinuteCents}
              isAdmin={isAdmin}
              onNew={() => {
                setView('new');
              }}
              onReload={reloadAfterChange}
              notify={notify}
            />
          )}
          {view === 'fleet' && (
            <Fleet dash={dash} isAdmin={isAdmin} onReload={reloadAfterChange} notify={notify} />
          )}
          {needsAdmin && !admin && <p role="status">Cargando Administración…</p>}
          {isAdmin && view === 'reports' && admin && <Reports dash={dash} admin={admin} />}
          {isAdmin && view === 'admin' && admin && (
            <AdminPanel
              admin={admin}
              currentUserId={user.id}
              refreshSession={refresh}
              onReload={reloadAfterChange}
              notify={notify}
            />
          )}
        </main>
        <footer className="app-version">
          <span>Versión {import.meta.env.VITE_APP_VERSION}</span>
          <span>
            Actualización: <time dateTime={import.meta.env.VITE_APP_UPDATED_AT}>{updatedAt}</time>{' '}
            (Colombia)
          </span>
        </footer>
      </div>

      <div id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
