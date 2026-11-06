import { RentalHistory } from './RentalHistory';
import { TrackingActions } from '../../components/TrackingActions';
import { useCallback, useEffect, useState } from 'react';
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

export function Workspace() {
  const { user, logout, refresh } = useSession();
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

  const reload = useCallback(async () => {
    setLoadError('');
    try {
      setDash(await api<Dashboard>('/dashboard'));
      if (isAdmin) setAdmin(await api<AdminData>('/admin/data'));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar Gestión.');
      throw error;
    }
  }, [isAdmin]);

  useEffect(() => {
    void reload().catch(() => {});
  }, [reload]);

  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === 'visible') void reload().catch(() => {});
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
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

  if (!dash || !user) return <main className="loading">{loadError ? <div><p role="alert">{loadError}</p><button className="button primary" onClick={() => void reload().catch(() => {})}>Reintentar</button></div> : 'Cargando la estación…'}</main>;

  const visible = NAV.filter((item) => isAdmin || !ADMIN_ONLY.includes(item.value));

  return (
    <>
      {loadError && <div role="alert">{loadError} <button className="button ghost" onClick={() => void reload().catch(() => {})}>Reintentar</button></div>}
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
              user={user}
              isAdmin={isAdmin}
              onNew={() => {
                setView('new');
              }}
              onReload={reload}
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
                await reload();
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
              onReload={reload}
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
              onReload={reload}
              notify={notify}
            />
          )}
          {view === 'fleet' && (
            <Fleet dash={dash} isAdmin={isAdmin} onReload={reload} notify={notify} />
          )}
          {view === 'reports' && admin && <Reports dash={dash} admin={admin} />}
          {view === 'admin' && admin && (
            <AdminPanel
              admin={admin}
              currentUserId={user.id}
              refreshSession={refresh}
              onReload={reload}
              notify={notify}
            />
          )}
        </main>
      </div>

      <div id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
